import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionKind, SessionStatus, kickoffFor } from '../sessions/entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { shortDate } from '../common/format.util';
import { prettyTime } from '../common/time.util';
import { coveredByDues, squadEntry } from '../payments/game-dues';
import { Rsvp, RsvpStatus } from './entities/rsvp.entity';
import { BillingService } from '../billing/billing.service';

type Person = { id: string; firstName: string; lastName: string };

@Injectable()
export class RsvpService {

  constructor(
    @InjectRepository(Rsvp) private rsvpRepo: Repository<Rsvp>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private payments: PaymentsService,
    private notifications: NotificationsService,
    private billing: BillingService,
  ) {}

  // ── Reading ──

  private async loadGame(sessionId: string, organizationId?: string) {
    const qb = this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .where('session.id = :sessionId', { sessionId });
    if (organizationId) qb.andWhere('group.organizationId = :organizationId', { organizationId });
    const session = await qb.getOne();
    if (!session) throw new NotFoundException('Game not found');
    if (session.kind === SessionKind.DUES) throw new BadRequestException('Dues periods don’t take RSVPs');
    return session;
  }

  /** In / waitlist / out / no reply for a game, in display order. */
  async board(session: Session) {
    const [rsvps, members] = await Promise.all([
      this.rsvpRepo.find({ where: { sessionId: session.id }, relations: ['player'], order: { statusAt: 'ASC' } }),
      this.membershipsRepo.find({ where: { groupId: session.groupId }, relations: ['player'] }),
    ]);
    const person = (p: Person) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName });
    const answered = new Set(rsvps.map((r) => r.playerId));
    return {
      capacity: session.group.targetPlayers,
      requireRsvp: session.group.requireRsvp,
      in: rsvps.filter((r) => r.status === RsvpStatus.IN).map((r) => person(r.player)),
      waitlist: rsvps.filter((r) => r.status === RsvpStatus.WAITLIST).map((r) => person(r.player)),
      out: rsvps.filter((r) => r.status === RsvpStatus.OUT).map((r) => person(r.player)),
      noReply: members.filter((m) => !answered.has(m.playerId)).map((m) => person(m.player)),
    };
  }

  async boardFor(sessionId: string, organizationId: string) {
    return this.board(await this.loadGame(sessionId, organizationId));
  }

  // ── Writing ──

  async setByOrganiser(sessionId: string, playerId: string, status: 'in' | 'out', organizationId: string) {
    const session = await this.loadGame(sessionId, organizationId);
    await this.apply(session, playerId, status, { force: true });
    return this.board(session);
  }

  async setByPlayer(sessionId: string, playerId: string, status: 'in' | 'out') {
    const session = await this.loadGame(sessionId);
    if (session.status !== SessionStatus.UPCOMING) throw new BadRequestException('This game is no longer taking replies');
    const member = await this.membershipsRepo.findOne({ where: { groupId: session.groupId, playerId } });
    if (!member) throw new ForbiddenException("You're not in this group");
    const result = await this.apply(session, playerId, status, { force: false });
    return { status: result, board: await this.board(session) };
  }

  /**
   * Core rules: "in" takes a spot if one is free, else joins the waitlist
   * (organisers can force past the cap). Leaving frees a spot for the first
   * person waiting. With requireRsvp, only confirmed players carry a payment.
   */
  private async apply(session: Session, playerId: string, wanted: 'in' | 'out', opts: { force: boolean }) {
    const existing = await this.rsvpRepo.findOne({ where: { sessionId: session.id, playerId } });
    const before = existing?.status;
    let status: RsvpStatus;

    if (wanted === 'in') {
      if (before === RsvpStatus.IN) return RsvpStatus.IN;
      const taken = await this.rsvpRepo.count({ where: { sessionId: session.id, status: RsvpStatus.IN } });
      status = opts.force || taken < session.group.targetPlayers ? RsvpStatus.IN : RsvpStatus.WAITLIST;
      if (before === RsvpStatus.WAITLIST && status === RsvpStatus.WAITLIST) return RsvpStatus.WAITLIST;
    } else {
      status = RsvpStatus.OUT;
      if (before === RsvpStatus.OUT) return RsvpStatus.OUT;
    }

    const row = existing ?? this.rsvpRepo.create({ sessionId: session.id, playerId });
    row.status = status;
    row.statusAt = new Date();
    await this.rsvpRepo.save(row);
    await this.syncPayment(session, playerId, status);

    if (before === RsvpStatus.IN && status !== RsvpStatus.IN) await this.promoteFromWaitlist(session);
    if (status === RsvpStatus.IN) await this.maybeAnnounceFull(session);
    return status;
  }

  private async promoteFromWaitlist(session: Session) {
    const taken = await this.rsvpRepo.count({ where: { sessionId: session.id, status: RsvpStatus.IN } });
    if (taken >= session.group.targetPlayers) return;
    const next = await this.rsvpRepo.findOne({
      where: { sessionId: session.id, status: RsvpStatus.WAITLIST },
      order: { statusAt: 'ASC' },
    });
    if (!next) return;
    next.status = RsvpStatus.IN;
    next.statusAt = new Date();
    await this.rsvpRepo.save(next);
    await this.syncPayment(session, next.playerId, RsvpStatus.IN);
    this.notifications.later(() =>
      this.notifications.notifyPlayers([next.playerId], {
        kind: 'rsvp_promoted',
        title: "A spot opened up — you're in! ⚽",
        body: `${session.group.name} · ${shortDate(session.date)}`,
        url: '/me',
        critical: true,
      }),
    );
  }

  private async maybeAnnounceFull(session: Session) {
    const taken = await this.rsvpRepo.count({ where: { sessionId: session.id, status: RsvpStatus.IN } });
    if (taken !== session.group.targetPlayers) return;
    this.notifications.later(() =>
      this.notifications.notifyOrganisers(session.group.organizationId, {
        kind: 'game_full',
        title: `${session.group.name} is full ✅`,
        body: `${taken}/${session.group.targetPlayers} confirmed for ${shortDate(session.date)}.`,
        url: `/sessions/${session.id}`,
      }),
    );
  }

  private async syncPayment(session: Session, playerId: string, status: RsvpStatus) {
    if (!session.group.requireRsvp) return;
    const payment = await this.paymentsRepo.findOne({ where: { sessionId: session.id, playerId } });
    if (status === RsvpStatus.IN && !payment) {
      await this.paymentsRepo.save(this.paymentsRepo.create(squadEntry(session.group, session.id, playerId)));
      await this.billing.applyCredits(session.groupId, [playerId]);
    } else if (status !== RsvpStatus.IN && payment && (payment.status === PaymentStatus.PENDING || coveredByDues(payment))) {
      // Paid players who drop out keep their payment; the organiser decides on refunds.
      await this.paymentsRepo.remove(payment);
    }
    await this.payments.recalculateSessionTotal(session.id);
  }

  /** New game in an RSVP group: ask everyone who's in. */
  async announceGame(sessionId: string) {
    const session = await this.sessionsRepo.findOne({ where: { id: sessionId }, relations: ['group'] });
    if (!session?.group.requireRsvp) return;
    const members = await this.membershipsRepo.find({ where: { groupId: session.groupId } });
    const ko = kickoffFor(session);
    await this.notifications.notifyPlayers(
      members.map((m) => m.playerId),
      {
        kind: 'rsvp_open',
        title: `Who's in? ${session.group.name}`,
        body: `${shortDate(session.date)}${ko ? `, kick-off ${prettyTime(ko)}` : ''} · ${session.group.targetPlayers} spots. Tap to confirm.`,
        url: '/me',
      },
    );
  }

  /** A person's reply for each game, across all their player records. */
  async statusesForMany(playerIds: string[], sessionIds: string[]) {
    if (!playerIds.length || !sessionIds.length) return new Map<string, RsvpStatus>();
    const rows = await this.rsvpRepo
      .createQueryBuilder('r')
      .where('r.playerId IN (:...playerIds)', { playerIds })
      .andWhere('r.sessionId IN (:...sessionIds)', { sessionIds })
      .getMany();
    return new Map(rows.map((r) => [r.sessionId, r.status]));
  }

  /** The signed-in player's reply for each game. */
  async statusesFor(playerId: string, sessionIds: string[]) {
    if (!sessionIds.length) return new Map<string, RsvpStatus>();
    const rows = await this.rsvpRepo
      .createQueryBuilder('r')
      .where('r.playerId = :playerId', { playerId })
      .andWhere('r.sessionId IN (:...sessionIds)', { sessionIds })
      .getMany();
    return new Map(rows.map((r) => [r.sessionId, r.status]));
  }
}
