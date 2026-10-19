import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { markPartPaid } from '../payments/part-paid';
import { Session, SessionKind, SessionStatus, kickoffFor } from './entities/session.entity';
import { RsvpService } from '../rsvp/rsvp.service';
import { RatingsService } from '../ratings/ratings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { naira, shortDate } from '../common/format.util';
import { prettyTime } from '../common/time.util';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { MailService } from '../mail/mail.service';
import { CreateSessionDto, RecurrenceType } from './dto/create-session.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { BillingService } from '../billing/billing.service';
import { PaymentsService } from '../payments/payments.service';
import { gameTarget, paidForGames, squadEntry } from '../payments/game-dues';

export type GameList = 'ahead' | 'collect' | 'past';

/** Still to be played: not ended or cancelled, and today or later. */
const AHEAD = `(session.status = 'upcoming' AND session.date >= CURRENT_DATE)`;
/** The Games screens' lists, as conditions on `session`. */
const GAME_LISTS: Record<GameList, string> = {
  ahead: AHEAD,
  past: `NOT ${AHEAD}`,
  // Played (or past its day) and someone who came hasn't paid.
  collect: `NOT ${AHEAD} AND session.status <> 'cancelled' AND EXISTS (SELECT 1 FROM payments p WHERE p.session_id = session.id AND p.status = 'pending' AND (p.attendance IS NULL OR p.attendance <> 'no_show'))`,
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private mailService: MailService,
    private rsvp: RsvpService,
    private ratings: RatingsService,
    private notifications: NotificationsService,
    private billing: BillingService,
    private payments: PaymentsService,
  ) {}

  async create(dto: CreateSessionDto, organizationId: string) {
    const group = await this.groupsRepo.findOne({
      where: { id: dto.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    const memberships = await this.membershipsRepo.find({
      where: { groupId: dto.groupId },
    });

    const dates = this.generateDates(
      dto.date,
      dto.recurrenceType || RecurrenceType.NONE,
      dto.recurrenceCount || 1,
    );

    let firstSession: Session | null = null;

    for (const date of dates) {
      const session = this.sessionsRepo.create({
        groupId: dto.groupId,
        date,
        kickoffTime: dto.kickoffTime || null,
        targetAmount: gameTarget(group),
      });
      const saved = await this.sessionsRepo.save(session);
      firstSession ??= saved;

      // RSVP groups bill players as they confirm, not up front.
      if (memberships.length > 0 && !group.requireRsvp) {
        // Monthly-type groups: everyone's in the squad, but their dues cover the game.
        const payments = memberships.map((m) => this.paymentsRepo.create(squadEntry(group, saved.id, m.playerId)));
        await this.paymentsRepo.save(payments);
        await this.billing.applyCredits(dto.groupId, memberships.map((m) => m.playerId));
      }
    }

    if (group.requireRsvp) {
      const first = await this.sessionsRepo.findOne({ where: { groupId: dto.groupId, date: dates[0] } });
      if (first) this.notifications.later(() => this.rsvp.announceGame(first.id));
    } else if (memberships.length && firstSession) {
      // Everyone's billed straight away, so tell them when it is and what it costs.
      const first = firstSession;
      const ko = kickoffFor({ kickoffTime: first.kickoffTime, group });
      const more = dates.length > 1 ? ` (and ${dates.length - 1} more)` : '';
      this.notifications.later(() =>
        this.notifications.notifyPlayers(
          memberships.map((m) => m.playerId),
          {
            kind: 'game_scheduled',
            title: `New game: ${group.name} ⚽`,
            body: `${shortDate(first.date)}${ko ? `, kick-off ${prettyTime(ko)}` : ''}${more}. ${naira(group.feePerPlayer)} — tap for where to pay.`,
            url: '/me',
          },
        ),
      );
    }

    // Open the first game of a series: it's the one players hear about and pay for first.
    return this.findOne(firstSession!.id, organizationId);
  }

  private generateDates(startDate: string, recurrenceType: RecurrenceType, count: number): string[] {
    if (recurrenceType === RecurrenceType.NONE || count <= 1) {
      return [startDate];
    }

    const dates: string[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      switch (recurrenceType) {
        case RecurrenceType.WEEKLY:
          d.setDate(d.getDate() + i * 7);
          break;
        case RecurrenceType.BIWEEKLY:
          d.setDate(d.getDate() + i * 14);
          break;
        case RecurrenceType.MONTHLY:
          d.setMonth(d.getMonth() + i);
          break;
      }
      dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
  }

  async findAll(organizationId: string, groupId?: string) {
    const qb = this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('group.organizationId = :organizationId', { organizationId })
      .orderBy('session.date', 'DESC');

    if (groupId) {
      qb.andWhere('session.groupId = :groupId', { groupId });
    }

    return this.markGamePaid(await qb.getMany());
  }

  /**
   * A page of games, newest first, optionally one group's and one of the lists the Games screens
   * show: coming up (soonest first), to collect (played, someone who came still owes), played.
   * `meta.counts` gives each list's size for the filter labels.
   */
  async findAllPaginated(
    organizationId: string,
    query: PaginationDto,
    groupId?: string,
    when?: GameList,
  ): Promise<PaginatedResult<Session> & { meta: { counts: Record<GameList, number> } }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const base = () => {
      const qb = this.sessionsRepo
        .createQueryBuilder('session')
        .innerJoin('session.group', 'group')
        .where('group.organizationId = :organizationId', { organizationId });
      if (groupId) qb.andWhere('session.groupId = :groupId', { groupId });
      return qb;
    };
    const [ahead, collect, past] = await Promise.all(
      (['ahead', 'collect', 'past'] as GameList[]).map((w) => base().andWhere(GAME_LISTS[w]).getCount()),
    );

    const qb = this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('group.organizationId = :organizationId', { organizationId })
      .orderBy('session.date', when === 'ahead' ? 'ASC' : 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (groupId) {
      qb.andWhere('session.groupId = :groupId', { groupId });
    }
    if (when) qb.andWhere(GAME_LISTS[when]);

    const [data, total] = await qb.getManyAndCount();
    await this.markGamePaid(data);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), counts: { ahead, collect, past } },
    };
  }

  /**
   * Sets payment.gamePaid on each game's squad (paid for the game, or for its dues period), and
   * payment.paidSoFar on any due a player has part paid.
   */
  private async markGamePaid(sessions: Session[]) {
    await markPartPaid(this.sessionsRepo.manager, sessions);
    const games = sessions.filter((s) => s.kind !== SessionKind.DUES && s.group);
    if (!games.length) return sessions;
    const paid = await paidForGames(this.sessionsRepo.manager, games);
    for (const g of games) for (const p of g.payments ?? []) p.gamePaid = paid.get(g.id)?.get(p.playerId) ?? 'unpaid';
    return sessions;
  }

  async findOne(id: string, organizationId: string) {
    const session = await this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('session.id = :id', { id })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();

    if (!session) throw new NotFoundException('Game not found');
    await this.markGamePaid([session]);
    return session;
  }

  async updateStatus(id: string, status: string, organizationId: string) {
    if (!Object.values(SessionStatus).includes(status as SessionStatus)) {
      throw new BadRequestException('Unknown game status');
    }
    const session = await this.findOne(id, organizationId);
    const wasCompleted = session.status === SessionStatus.COMPLETED;
    const wasCancelled = session.status === SessionStatus.CANCELLED;
    session.status = status as SessionStatus;
    // Full time opens the vote (once: reopening and ending again keeps the first time).
    if (session.status === SessionStatus.COMPLETED && !session.voteOpensAt) session.voteOpensAt = new Date();
    const saved = await this.sessionsRepo.save(session);

    // Called off: what members paid for it by transfer goes back to their credit. Back on: its
    // dues are payable from credit again.
    if (!wasCancelled && saved.status === SessionStatus.CANCELLED) {
      await this.billing.releaseTransferDues(session, { reopen: true });
    } else if (wasCancelled && saved.status !== SessionStatus.CANCELLED) {
      await this.billing.applyCredits(session.groupId, (session.payments ?? []).map((p) => p.playerId));
    }

    // Full-time: invite the squad to vote.
    if (!wasCompleted && saved.status === SessionStatus.COMPLETED && saved.kind !== SessionKind.DUES) {
      this.notifications.later(async () => {
        const token = await this.ratings.ensureVotingToken(saved.id);
        await this.notifications.notifyPlayers(
          // Only the players who came; no-shows don't vote.
          (session.payments ?? []).filter((p) => p.attendance !== 'no_show').map((p) => p.playerId),
          {
            kind: 'vote_open',
            title: `Who was Player of the Match? 🏆`,
            body: `${session.group.name}: one pick, 10 seconds.`,
            url: `/v/${token}`,
          },
        );
      });
    }
    return saved;
  }

  /**
   * Full time: everyone who said they were in counts as came, except `noShows` (payment ids), who
   * owe nothing for it; then the game is completed and the players who came are invited to vote.
   */
  async endGame(id: string, noShows: string[], organizationId: string, markedBy?: string) {
    const session = await this.findOne(id, organizationId);
    const missing = new Set(noShows);
    for (const p of session.payments ?? []) {
      if (missing.has(p.id)) {
        if (p.attendance !== 'no_show') await this.payments.markNoShow(p.id, organizationId, markedBy);
      } else if (!p.attendance) {
        await this.paymentsRepo.update(p.id, { attendance: 'came' });
      }
    }
    await this.updateStatus(id, SessionStatus.COMPLETED, organizationId);
    return this.findOne(id, organizationId);
  }

  async remove(id: string, organizationId: string) {
    const session = await this.findOne(id, organizationId);
    const { groupId, payments } = session;
    await this.sessionsRepo.remove(session);
    // Its payments go with it; money members paid for it by transfer goes to their credit.
    await this.billing.releaseTransferDues({ groupId, payments }, { reopen: false });
  }

  async countByOrganization(organizationId: string) {
    return this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoin('session.group', 'group')
      .where('group.organizationId = :organizationId', { organizationId })
      .getCount();
  }

  countAll() {
    return this.sessionsRepo.count();
  }

  /** Organiser's "Remind" button: a push to everyone who still owes for this game/period. */
  async sendReminders(sessionId: string, organizationId: string) {
    const session = await this.findOne(sessionId, organizationId);
    if (session.status === SessionStatus.CANCELLED) return { sent: 0, missed: 0 };
    const unpaid = (session.payments || []).filter((p) => p.status === PaymentStatus.PENDING);
    if (!unpaid.length) return { sent: 0, missed: 0 };
    const what = session.label ? `${session.label} dues` : `the ${shortDate(session.date)} game`;
    // Each player is asked for what's left: someone who's part paid gets the rest, not the full fee.
    const byLeft = new Map<number, string[]>();
    for (const p of unpaid) {
      const left = Number(p.amount) - (p.paidSoFar ?? 0);
      byLeft.set(left, [...(byLeft.get(left) ?? []), p.playerId]);
    }
    let sent = 0;
    let missedTotal = 0;
    for (const [left, playerIds] of byLeft) {
      const { delivered, missed } = await this.notifications.notifyPlayers(playerIds, {
        kind: 'payment_reminder',
        title: `Quick one — ${naira(left)} for ${session.group?.name ?? 'your group'}`,
        body: `Still open for ${what}. Tap for the account details and your payment code.`,
        url: '/me/pay',
      });
      sent += delivered;
      missedTotal += missed;
    }
    return { sent, missed: missedTotal };
  }

  async totalCollectedByOrganization(organizationId: string): Promise<number> {
    const result = await this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoin('session.group', 'group')
      .select('COALESCE(SUM(session.collectedAmount), 0)', 'total')
      .where('group.organizationId = :organizationId', { organizationId })
      .getRawOne();
    return Number(result.total);
  }
}
