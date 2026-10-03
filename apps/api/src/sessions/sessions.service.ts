import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { gameTarget, paidForGames, squadEntry } from '../payments/game-dues';

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
    let lastSession: Session | null = null;

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

      lastSession = saved;
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

    // Return the first session (or the only one)
    return this.findOne(dates.length > 1 ? lastSession!.id : lastSession!.id, organizationId);
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

  async findAllPaginated(
    organizationId: string,
    query: PaginationDto,
    groupId?: string,
  ): Promise<PaginatedResult<Session>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('group.organizationId = :organizationId', { organizationId })
      .orderBy('session.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (groupId) {
      qb.andWhere('session.groupId = :groupId', { groupId });
    }

    const [data, total] = await qb.getManyAndCount();
    await this.markGamePaid(data);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Sets payment.gamePaid on each game's squad: paid for the game, or for its dues period. */
  private async markGamePaid(sessions: Session[]) {
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

    if (!session) throw new NotFoundException('Session not found');
    await this.markGamePaid([session]);
    return session;
  }

  async updateStatus(id: string, status: string, organizationId: string) {
    const session = await this.findOne(id, organizationId);
    const wasCompleted = session.status === SessionStatus.COMPLETED;
    const wasCancelled = session.status === SessionStatus.CANCELLED;
    session.status = status as SessionStatus;
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
          (session.payments ?? []).map((p) => p.playerId),
          {
            kind: 'vote_open',
            title: `Who was Player of the Match? 🏆`,
            body: `${session.group.name} — cast your votes in 30 seconds.`,
            url: `/v/${token}`,
          },
        );
      });
    }
    return saved;
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
    const unpaid = (session.payments || []).filter((p) => p.status === PaymentStatus.PENDING);
    if (!unpaid.length) return { sent: 0, missed: 0 };
    const what = session.label ? `${session.label} dues` : `the ${shortDate(session.date)} game`;
    const { delivered, missed } = await this.notifications.notifyPlayers(
      unpaid.map((p) => p.playerId),
      {
        kind: 'payment_reminder',
        title: `Quick one — ${naira(unpaid[0].amount)} for ${session.group?.name ?? 'your group'}`,
        body: `Still open for ${what}. Tap for the account details and your reference.`,
        url: '/me/pay',
      },
    );
    return { sent: delivered, missed };
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
