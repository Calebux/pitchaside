import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Player } from '../players/entities/player.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Session, SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { RsvpService } from '../rsvp/rsvp.service';
import { RatingsService } from '../ratings/ratings.service';

/** Everything a player sees on their home page, in one request. */
@Injectable()
export class PlayerPortalService {
  constructor(
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private rsvp: RsvpService,
    private ratings: RatingsService,
  ) {}

  async home(player: Player) {
    const memberships = await this.membershipsRepo.find({
      where: { playerId: player.id },
      relations: ['group'],
    });
    const groupIds = memberships.map((m) => m.groupId);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const [games, owed, openVotes, ratings] = await Promise.all([
      groupIds.length
        ? this.sessionsRepo.find({
            where: {
              groupId: In(groupIds),
              kind: SessionKind.GAME,
              status: SessionStatus.UPCOMING,
              date: MoreThanOrEqual(todayIso),
            },
            relations: ['group'],
            order: { date: 'ASC' },
            take: 6,
          })
        : Promise.resolve([] as Session[]),
      this.paymentsRepo
        .createQueryBuilder('payment')
        .innerJoinAndSelect('payment.session', 'session')
        .innerJoinAndSelect('session.group', 'group')
        .where('payment.playerId = :playerId', { playerId: player.id })
        .andWhere('payment.status = :pending', { pending: PaymentStatus.PENDING })
        .andWhere('session.status != :cancelled', { cancelled: SessionStatus.CANCELLED })
        .orderBy('session.date', 'ASC')
        .getMany(),
      this.ratings.openVotesFor(player.id, player.organizationId),
      this.ratings.getPlayerRatings(player.id, player.organizationId),
    ]);

    const statuses = await this.rsvp.statusesFor(player.id, games.map((g) => g.id));
    const myPayments = games.length
      ? await this.paymentsRepo.find({ where: { playerId: player.id, sessionId: In(games.map((g) => g.id)) } })
      : [];

    const upcoming = [];
    for (const g of games) {
      const board = await this.rsvp.board(g);
      const payment = myPayments.find((p) => p.sessionId === g.id);
      upcoming.push({
        id: g.id,
        date: g.date,
        groupId: g.groupId,
        groupName: g.group.name,
        schedule: g.group.schedule,
        requireRsvp: g.group.requireRsvp,
        myStatus: statuses.get(g.id) ?? null,
        waitlistPosition: board.waitlist.findIndex((p) => p.id === player.id) + 1 || null,
        confirmed: board.in.length,
        capacity: board.capacity,
        waitlist: board.waitlist.length,
        payment: payment ? { status: payment.status, amount: Number(payment.amount) } : null,
      });
    }

    const tables = [];
    for (const m of memberships) {
      const table = await this.ratings.getGroupTable(m.groupId, player.organizationId);
      const rank = table.rows.findIndex((r) => r.player.id === player.id);
      tables.push({
        groupId: m.groupId,
        groupName: m.group.name,
        games: table.games,
        top: table.rows.slice(0, 5).map((r, i) => ({
          rank: i + 1,
          id: r.player.id,
          name: `${r.player.firstName} ${r.player.lastName}`,
          points: r.points,
        })),
        me: rank >= 0 ? { rank: rank + 1, points: table.rows[rank].points } : null,
      });
    }

    return {
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        phone: player.phone,
      },
      groups: memberships.map((m) => ({
        id: m.groupId,
        name: m.group.name,
        schedule: m.group.schedule,
        feePerPlayer: Number(m.group.feePerPlayer),
        paymentType: m.group.paymentType,
        paymentRef: m.paymentRef,
        account: m.group.accountNumber
          ? { accountNumber: m.group.accountNumber, accountName: m.group.accountName, bankName: m.group.bankName }
          : null,
      })),
      upcoming,
      owed: owed.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        groupId: p.session.groupId,
        groupName: p.session.group.name,
        label: p.session.label ? `${p.session.label} dues` : null,
        date: p.session.date,
      })),
      openVotes,
      ratings,
      tables,
    };
  }
}
