import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Session, SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Vote } from '../ratings/entities/vote.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RsvpService } from '../rsvp/rsvp.service';
import { RatingsService } from '../ratings/ratings.service';
import { naira } from '../common/format.util';
import { localDate, prettyTime, zonedInstant } from '../common/time.util';
import { ReminderLog } from './entities/reminder-log.entity';

const EVERY_MS = 10 * 60 * 1000;
const DUES_REMINDER_DAYS = [3, 7];

/**
 * Crafted push reminders around each game and each dues period.
 * Idempotent: every reminder has a key recorded in reminder_logs.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(ReminderLog) private logRepo: Repository<ReminderLog>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    @InjectRepository(Vote) private votesRepo: Repository<Vote>,
    private notifications: NotificationsService,
    private rsvp: RsvpService,
    private ratings: RatingsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.logger.error(`Reminder tick failed: ${err.message}`));
    }, EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns true the first time a key is claimed. */
  private async claim(key: string) {
    const res = await this.logRepo
      .createQueryBuilder()
      .insert()
      .values({ key })
      .orIgnore()
      .execute();
    // ON CONFLICT DO NOTHING returns no row when the key already exists.
    return (res.raw as unknown[]).length > 0;
  }

  async tick(now = new Date()) {
    await this.dayBefore(now);
    await this.kickOff(now);
    await this.morningAfter(now);
    await this.duesChasers(now);
  }

  private games(date: string) {
    return this.sessionsRepo.find({
      where: { date, kind: SessionKind.GAME, status: In([SessionStatus.UPCOMING, SessionStatus.COMPLETED]) },
      relations: ['group', 'payments', 'payments.player'],
    });
  }

  /** Squad for reminders: confirmed players for RSVP groups, everyone billed otherwise. */
  private async squad(game: Session) {
    if (game.group.requireRsvp) return (await this.rsvp.board(game)).in.map((p) => p.id);
    return (game.payments ?? []).map((p) => p.playerId);
  }

  private async refs(groupId: string, playerIds: string[]) {
    if (!playerIds.length) return new Map<string, string>();
    const rows = await this.membershipsRepo.find({ where: { groupId, playerId: In(playerIds) } });
    return new Map(rows.map((m) => [m.playerId, m.paymentRef]));
  }

  // ── 6pm the day before ──
  private async dayBefore(now: Date) {
    if (now < zonedInstant(localDate(0, undefined, now), '18:00')) return;
    for (const game of await this.games(localDate(1, undefined, now))) {
      if (game.status !== SessionStatus.UPCOMING || !(await this.claim(`eve:${game.id}`))) continue;
      const g = game.group;
      const when = g.kickoffTime ? `Kick-off ${prettyTime(g.kickoffTime)}. ` : '';
      const squad = await this.squad(game);
      const board = await this.rsvp.board(game);
      const confirmed = g.requireRsvp ? `${board.in.length}/${board.capacity} confirmed.` : `${squad.length} in the squad.`;
      const unpaid = new Set(
        (game.payments ?? []).filter((p) => p.status === PaymentStatus.PENDING).map((p) => p.playerId),
      );
      const refs = await this.refs(g.id, [...unpaid]);

      for (const playerId of squad) {
        const owes = unpaid.has(playerId);
        await this.notifications.notifyPlayers([playerId], {
          kind: 'reminder_eve',
          title: `Tomorrow: ${g.name} ⚽`,
          body: `${when}You're in — ${confirmed}${owes ? ` ${naira(g.feePerPlayer)} to pay, ref ${refs.get(playerId) ?? ''}.` : ''}`.trim(),
          url: '/me',
        });
      }

      const spots = board.capacity - board.in.length;
      if (g.requireRsvp && spots > 0 && board.noReply.length) {
        await this.notifications.notifyPlayers(
          board.noReply.map((p) => p.id),
          {
            kind: 'rsvp_nudge',
            title: `${spots} spot${spots === 1 ? '' : 's'} left for tomorrow`,
            body: `${g.name}${g.kickoffTime ? ` at ${prettyTime(g.kickoffTime)}` : ''}. Tap “I'm in” before they're gone.`,
            url: '/me',
          },
        );
      }
    }
  }

  // ── 2 hours before kick-off ──
  private async kickOff(now: Date) {
    for (const game of await this.games(localDate(0, undefined, now))) {
      const g = game.group;
      if (!g.kickoffTime || game.status !== SessionStatus.UPCOMING) continue;
      const ko = zonedInstant(game.date, g.kickoffTime);
      if (now < new Date(ko.getTime() - 2 * 3600_000) || now >= ko) continue;
      if (!(await this.claim(`ko:${game.id}`))) continue;

      const squad = await this.squad(game);
      const unpaid = new Set(
        (game.payments ?? []).filter((p) => p.status === PaymentStatus.PENDING).map((p) => p.playerId),
      );
      const refs = await this.refs(g.id, [...unpaid]);
      for (const playerId of squad) {
        const owes = unpaid.has(playerId);
        await this.notifications.notifyPlayers([playerId], {
          kind: 'reminder_kickoff',
          title: 'Kick-off in 2 hours ⏱',
          body: `${g.name} · ${prettyTime(g.kickoffTime)}. ${squad.length} playing — lace up.${
            owes ? ` Still ${naira(g.feePerPlayer)} to pay (ref ${refs.get(playerId) ?? ''}).` : ''
          }`,
          url: '/me',
        });
      }
    }
  }

  // ── The morning after: settle up, then vote ──
  private async morningAfter(now: Date) {
    const today = localDate(0, undefined, now);
    const nineAm = zonedInstant(today, '09:00');
    const noon = zonedInstant(today, '12:00');
    if (now < nineAm) return;

    for (const game of await this.games(localDate(-1, undefined, now))) {
      const g = game.group;
      const pending = (game.payments ?? []).filter((p) => p.status === PaymentStatus.PENDING);
      const refs = await this.refs(g.id, pending.map((p) => p.playerId));
      for (const p of pending) {
        if (!(await this.claim(`owe:${p.id}`))) continue;
        await this.notifications.notifyPlayers([p.playerId], {
          kind: 'payment_reminder',
          title: `${naira(p.amount)} for last night 🙏`,
          body: `${g.name} — tap for the account details. Your reference is ${refs.get(p.playerId) ?? ''}.`,
          url: '/me/pay',
        });
      }

      if (now < noon) continue;
      const squad = (game.payments ?? []).map((p) => p.playerId);
      if (squad.length < 2) continue;
      const voted = new Set(
        (await this.votesRepo.find({ where: { sessionId: game.id } })).map((v) => v.voterId),
      );
      const waiting = squad.filter((id) => !voted.has(id));
      if (!waiting.length || !(await this.claim(`votenudge:${game.id}`))) continue;
      const token = await this.ratings.ensureVotingToken(game.id);
      await this.notifications.notifyPlayers(waiting, {
        kind: 'vote_nudge',
        title: 'Who was the star last night? 🏆',
        body: `${g.name}: ${voted.size}/${squad.length} have voted. Takes 30 seconds.`,
        url: `/v/${token}`,
      });
    }
  }

  // ── Dues: nudge on day 3 and day 7 of the period ──
  private async duesChasers(now: Date) {
    const today = localDate(0, undefined, now);
    if (now < zonedInstant(today, '10:00')) return;
    const pending = await this.paymentsRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.session', 's')
      .innerJoinAndSelect('s.group', 'g')
      .where('s.kind = :kind', { kind: SessionKind.DUES })
      .andWhere('p.status = :status', { status: PaymentStatus.PENDING })
      .andWhere('s.status != :cancelled', { cancelled: SessionStatus.CANCELLED })
      .getMany();

    for (const p of pending) {
      const start = new Date(`${p.session.date.slice(0, 10)}T00:00:00Z`).getTime();
      const age = Math.floor((new Date(`${today}T00:00:00Z`).getTime() - start) / 86_400_000);
      // Only the reminder that's due now (with a 2-day grace), never a backlog blast.
      const day = DUES_REMINDER_DAYS.find((d) => age >= d && age <= d + 2);
      if (!day || !(await this.claim(`dues${day}:${p.id}`))) continue;
      const ref = (await this.refs(p.session.groupId, [p.playerId])).get(p.playerId);
      const g = p.session.group;
      await this.notifications.notifyPlayers([p.playerId], {
        kind: 'dues_reminder',
        title: `${p.session.label ?? 'Dues'}: ${naira(p.amount)} outstanding`,
        body: g.accountNumber
          ? `${g.name} — pay ${g.bankName} ${g.accountNumber}, ref ${ref ?? ''}.`
          : `${g.name} — tap to see how to pay.`,
        url: '/me/pay',
      });
    }
  }
}
