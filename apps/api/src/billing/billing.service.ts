import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Group, PaymentType } from '../groups/entities/group.entity';
import { GroupMembership, MemberRole } from '../groups/entities/group-membership.entity';
import { Session, SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Player } from '../players/entities/player.entity';
import { PaymentsService } from '../payments/payments.service';
import { BankTransfer, TransferStatus } from './entities/bank-transfer.entity';
import { IncomingTransfer, PAYREP_CLIENT, PayrepClient } from './payrep/payrep.client';
import { MockPayrepClient } from './payrep/mock-payrep.client';
import { NotificationsService } from '../notifications/notifications.service';
import { naira, phoneKey } from '../common/format.util';

const PERIODIC_TYPES = [
  PaymentType.WEEKLY,
  PaymentType.MONTHLY,
  PaymentType.QUARTERLY,
  PaymentType.ANNUALLY,
];

// Unambiguous characters for human-typed references (no 0/O, 1/I/L).
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_PATTERN = /\bPA[- ]?([A-HJ-NP-Z2-9]{5})\b/i;

export interface BillingPeriod {
  /** ISO date (YYYY-MM-DD) of the first day of the period. */
  start: string;
  label: string;
}

@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(Player) private playersRepo: Repository<Player>,
    @InjectRepository(BankTransfer) private transfersRepo: Repository<BankTransfer>,
    @Inject(PAYREP_CLIENT) private payrep: PayrepClient,
    private paymentsService: PaymentsService,
    private notifications: NotificationsService,
  ) {}

  // ── Lifecycle: open new dues periods as time rolls over ──

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.ensureAllCurrentPeriods().catch((err) =>
        this.logger.error(`Dues rollover failed: ${err.message}`),
      );
    }, 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async ensureAllCurrentPeriods() {
    const groups = await this.groupsRepo.find({ where: { paymentType: In(PERIODIC_TYPES) } });
    for (const group of groups) await this.ensureCurrentPeriod(group);
  }

  // ── Group setup: invite code + collection account + first dues period ──

  /** Idempotent: fills in whatever the group is missing. Account failures are non-fatal. */
  async setupGroup(group: Group): Promise<Group> {
    if (!group.inviteCode) {
      group.inviteCode = randomBytes(6).toString('base64url');
      await this.groupsRepo.save(group);
    }
    if (!group.accountNumber) {
      try {
        await this.provisionAccount(group);
      } catch (err: any) {
        this.logger.warn(`Account provisioning failed for group ${group.id}: ${err.message}`);
      }
    }
    await this.ensureCurrentPeriod(group);
    return group;
  }

  async provisionAccount(group: Group): Promise<Group> {
    const account = await this.payrep.createAccount({
      reference: group.id,
      accountName: `PitchAside – ${group.name}`.slice(0, 60),
    });
    group.accountNumber = account.accountNumber;
    group.accountName = account.accountName;
    group.bankName = account.bankName;
    group.accountReference = account.providerReference;
    return this.groupsRepo.save(group);
  }

  async regenerateInviteCode(groupId: string, organizationId: string) {
    const group = await this.findGroup(groupId, organizationId);
    group.inviteCode = randomBytes(6).toString('base64url');
    return this.groupsRepo.save(group);
  }

  async getBilling(groupId: string, organizationId: string) {
    const group = await this.findGroup(groupId, organizationId);
    await this.setupGroup(group);
    const current = PERIODIC_TYPES.includes(group.paymentType)
      ? await this.sessionsRepo.findOne({
          where: { groupId: group.id, kind: SessionKind.DUES, date: periodFor(group.paymentType).start },
        })
      : null;
    const unmatched = await this.transfersRepo.count({
      where: { groupId: group.id, status: TransferStatus.UNMATCHED },
    });
    return {
      inviteCode: group.inviteCode,
      paymentType: group.paymentType,
      account: group.accountNumber
        ? { accountNumber: group.accountNumber, accountName: group.accountName, bankName: group.bankName }
        : null,
      currentPeriod: current ? { id: current.id, label: current.label, date: current.date } : null,
      unmatchedTransfers: unmatched,
      providerMode: this.payrep.mode,
    };
  }

  // ── Dues periods ──

  async ensureCurrentPeriod(group: Group, now = new Date()): Promise<Session | null> {
    if (!PERIODIC_TYPES.includes(group.paymentType)) return null;
    const period = periodFor(group.paymentType, now);

    const existing = await this.sessionsRepo.findOne({
      where: { groupId: group.id, kind: SessionKind.DUES, date: period.start },
    });
    if (existing) return existing;

    const memberships = await this.membershipsRepo.find({ where: { groupId: group.id } });
    const fee = Number(group.feePerPlayer);
    const session = await this.sessionsRepo.save(
      this.sessionsRepo.create({
        groupId: group.id,
        date: period.start,
        kind: SessionKind.DUES,
        label: period.label,
        targetAmount: fee * (memberships.length || group.targetPlayers),
      }),
    );
    if (memberships.length) {
      await this.paymentsRepo.save(
        memberships.map((m) =>
          this.paymentsRepo.create({ sessionId: session.id, playerId: m.playerId, amount: fee }),
        ),
      );
      this.notifications.later(() =>
        this.notifications.notifyPlayers(
          memberships.map((m) => m.playerId),
          {
            kind: 'dues_open',
            title: `${group.name}: ${period.label} dues are open`,
            body: `${naira(fee)} — tap for the account details and your reference.`,
            url: '/me',
            message: group.accountNumber
              ? `⚽ ${group.name} — ${period.label} dues: ${naira(fee)}\nPay to ${group.bankName} ${group.accountNumber} (${group.accountName}) with your PitchAside reference in the narration.\n${this.notifications.appUrl('/me')}`
              : undefined,
          },
        ),
      );
    }
    return session;
  }

  /** Called whenever someone joins a group: give them a reference and this period's due. */
  async onMemberAdded(membership: GroupMembership) {
    if (!membership.paymentRef) {
      membership.paymentRef = await this.newPaymentRef();
      await this.membershipsRepo.save(membership);
    }
    const group = await this.groupsRepo.findOneOrFail({ where: { id: membership.groupId } });
    const period = await this.ensureCurrentPeriod(group);
    if (!period) return;

    const hasDue = await this.paymentsRepo.findOne({
      where: { sessionId: period.id, playerId: membership.playerId },
    });
    if (!hasDue) {
      await this.paymentsRepo.save(
        this.paymentsRepo.create({
          sessionId: period.id,
          playerId: membership.playerId,
          amount: Number(group.feePerPlayer),
        }),
      );
      const members = await this.membershipsRepo.count({ where: { groupId: group.id } });
      await this.sessionsRepo.update(period.id, {
        targetAmount: Number(group.feePerPlayer) * Math.max(members, 1),
      });
    }
  }

  private async newPaymentRef(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const bytes = randomBytes(5);
      const code = Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
      const ref = `PA${code}`;
      const clash = await this.membershipsRepo.findOne({ where: { paymentRef: ref } });
      if (!clash) return ref;
    }
    throw new Error('Could not allocate a unique payment reference');
  }

  // ── Public join / pay link ──

  async getPublicGroup(code: string) {
    const group = await this.groupsRepo.findOne({
      where: { inviteCode: code },
      relations: ['organization', 'memberships'],
    });
    if (!group) throw new NotFoundException('This link is invalid or has expired');
    if (!group.accountNumber) await this.setupGroup(group);
    return {
      groupName: group.name,
      organizationName: group.organization?.name,
      description: group.description,
      schedule: group.schedule,
      feePerPlayer: Number(group.feePerPlayer),
      paymentType: group.paymentType,
      memberCount: group.memberships?.length ?? 0,
      targetPlayers: group.targetPlayers,
      account: group.accountNumber
        ? { accountNumber: group.accountNumber, accountName: group.accountName, bankName: group.bankName }
        : null,
    };
  }

  /** A club's groups for the club invite link's "which groups do you play in?" step. */
  async publicGroupsForClub(organizationId: string) {
    const groups = await this.groupsRepo.find({
      where: { organizationId },
      relations: ['memberships'],
      order: { createdAt: 'ASC' },
    });
    for (const g of groups) if (!g.inviteCode) await this.setupGroup(g);
    return groups.map((g) => ({
      id: g.id,
      code: g.inviteCode,
      name: g.name,
      schedule: g.schedule,
      kickoffTime: g.kickoffTime,
      feePerPlayer: Number(g.feePerPlayer),
      paymentType: g.paymentType,
      memberCount: g.memberships?.length ?? 0,
      targetPlayers: g.targetPlayers,
    }));
  }

  /** This person's player record in the group's club, creating it if they're new to the club. */
  private async playerInClub(
    group: Group,
    person: { phone: string; firstName?: string; lastName?: string; email?: string },
  ) {
    const key = phoneKey(person.phone);
    const existing = await this.playersRepo
      .createQueryBuilder('p')
      .where('p.organizationId = :org', { org: group.organizationId })
      .andWhere(`regexp_replace(p.phone, '\\D', '', 'g') LIKE :suffix`, { suffix: `%${key}` })
      .getOne();
    if (existing) return existing;
    if (!person.firstName?.trim() || !person.lastName?.trim()) {
      throw new BadRequestException('First and last name are required');
    }
    const email = person.email?.trim() || undefined;
    const emailTaken = email
      ? await this.playersRepo.findOne({ where: { email, organizationId: group.organizationId } })
      : null;
    return this.playersRepo.save(
      this.playersRepo.create({
        firstName: person.firstName.trim(),
        lastName: person.lastName.trim(),
        phone: person.phone.trim(),
        email: emailTaken ? undefined : email,
        organizationId: group.organizationId,
      }),
    );
  }

  /** New or returning player whose phone number was just confirmed. */
  async joinGroup(code: string, input: { phone: string; firstName?: string; lastName?: string; email?: string }) {
    const group = await this.groupsRepo.findOne({ where: { inviteCode: code } });
    if (!group) throw new NotFoundException('This link is invalid or has expired');
    const player = await this.playerInClub(group, input);
    return { playerId: player.id, ...(await this.addToGroup(group, player)) };
  }

  /** Signed-in person tapping a group link — even one from a club they've never played for. */
  async joinGroupAsPerson(code: string, person: { phone: string; firstName: string; lastName: string }) {
    const group = await this.groupsRepo.findOne({ where: { inviteCode: code } });
    if (!group) throw new NotFoundException('This link is invalid or has expired');
    const player = await this.playerInClub(group, person);
    return this.addToGroup(group, player);
  }

  private async addToGroup(group: Group, player: Player) {
    let membership = await this.membershipsRepo.findOne({
      where: { groupId: group.id, playerId: player.id },
    });
    const alreadyMember = !!membership;
    if (!membership) {
      membership = await this.membershipsRepo.save(
        this.membershipsRepo.create({ groupId: group.id, playerId: player.id, role: MemberRole.PLAYER }),
      );
      this.notifications.later(() =>
        this.notifications.notifyOrganisers(group.organizationId, {
          kind: 'member_joined',
          title: `${player.firstName} ${player.lastName} joined ${group.name}`,
          body: 'Joined with the group link.',
          url: `/groups/${group.id}`,
        }),
      );
    }
    await this.onMemberAdded(membership);

    return {
      alreadyMember,
      firstName: player.firstName,
      paymentRef: membership.paymentRef,
      ...(await this.getPublicGroup(group.inviteCode)),
    };
  }

  // ── Incoming transfers ──

  async handleWebhook(rawBody: string, signature: string | undefined, payload: unknown) {
    if (!this.payrep.verifyWebhook(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const transfer = this.payrep.parseWebhook(payload);
    if (!transfer) return { received: true, ignored: true };
    return this.recordTransfer(transfer);
  }

  async recordTransfer(incoming: IncomingTransfer) {
    // Idempotent: providers retry webhooks.
    const seen = await this.transfersRepo.findOne({
      where: { providerTransactionId: incoming.providerTransactionId },
    });
    if (seen) return { received: true, duplicate: true, status: seen.status };

    const group = await this.groupsRepo.findOne({ where: { accountNumber: incoming.accountNumber } });
    const transfer = await this.transfersRepo.save(
      this.transfersRepo.create({
        providerTransactionId: incoming.providerTransactionId,
        groupId: group?.id,
        accountNumber: incoming.accountNumber,
        amount: incoming.amount,
        senderName: incoming.senderName,
        narration: incoming.narration,
        receivedAt: incoming.receivedAt,
        raw: incoming.raw as object,
        status: TransferStatus.UNMATCHED,
      }),
    );
    if (!group) {
      this.logger.warn(`Transfer ${incoming.providerTransactionId} to unknown account ${incoming.accountNumber}`);
      return { received: true, status: transfer.status };
    }
    const notifyUnmatched = () =>
      this.notifications.later(() =>
        this.notifications.notifyOrganisers(group.organizationId, {
          kind: 'transfer_unmatched',
          title: `${naira(incoming.amount)} needs matching`,
          body: `From ${incoming.senderName ?? 'unknown sender'} into ${group.name}. Tap to assign it.`,
          url: `/groups/${group.id}?tab=transfers`,
        }),
      );

    await this.ensureCurrentPeriod(group);
    const playerId = await this.identifyPayer(group.id, incoming);
    if (playerId) {
      const settled = await this.settleOldestDues(group.id, playerId, incoming.amount);
      if (settled.length) {
        transfer.status = TransferStatus.MATCHED;
        transfer.paymentId = settled[0].id;
        await this.transfersRepo.save(transfer);
      }
    }
    if (transfer.status === TransferStatus.UNMATCHED) notifyUnmatched();
    return { received: true, status: transfer.status };
  }

  /** Reference in the narration wins; otherwise a unique full-name match on the sender. */
  private async identifyPayer(groupId: string, t: IncomingTransfer): Promise<string | null> {
    const memberships = await this.membershipsRepo.find({
      where: { groupId },
      relations: ['player'],
    });

    const refMatch = t.narration?.toUpperCase().match(REF_PATTERN);
    if (refMatch) {
      const ref = `PA${refMatch[1].toUpperCase()}`;
      const m = memberships.find((x) => x.paymentRef === ref);
      if (m) return m.playerId;
    }

    if (t.senderName) {
      const words = new Set(normaliseName(t.senderName));
      const candidates = memberships.filter((m) => {
        const first = normaliseName(m.player.firstName);
        const last = normaliseName(m.player.lastName);
        return [...first, ...last].every((w) => words.has(w));
      });
      if (candidates.length === 1) return candidates[0].playerId;
    }
    return null;
  }

  /** Pays off the player's oldest pending dues/games in this group, as far as the amount stretches. */
  private async settleOldestDues(groupId: string, playerId: string, amount: number) {
    const pending = await this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.session', 'session')
      .where('session.groupId = :groupId', { groupId })
      .andWhere('payment.playerId = :playerId', { playerId })
      .andWhere('payment.status = :status', { status: PaymentStatus.PENDING })
      .andWhere('session.status != :cancelled', { cancelled: SessionStatus.CANCELLED })
      .orderBy('session.date', 'ASC')
      .getMany();

    let remaining = amount;
    const settled: Payment[] = [];
    for (const p of pending) {
      if (remaining + 0.001 < Number(p.amount)) break;
      remaining -= Number(p.amount);
      settled.push(p);
    }
    await this.markPaidFromTransfer(settled);
    return settled;
  }

  private async markPaidFromTransfer(payments: Payment[]) {
    if (!payments.length) return;
    const now = new Date();
    for (const p of payments) {
      p.status = PaymentStatus.PAID;
      p.paidAt = now;
      p.source = 'transfer';
      p.markedBy = 'payrep';
    }
    await this.paymentsRepo.save(payments);
    for (const sessionId of new Set(payments.map((p) => p.sessionId))) {
      await this.paymentsService.recalculateSessionTotal(sessionId);
    }
    this.notifications.later(() => this.paymentsService.sendReceipts(payments.map((p) => p.id), 'transfer'));
  }

  async listTransfers(groupId: string, organizationId: string) {
    await this.findGroup(groupId, organizationId);
    return this.transfersRepo.find({
      where: { groupId },
      relations: ['payment', 'payment.player', 'payment.session'],
      order: { receivedAt: 'DESC' },
      take: 50,
    });
  }

  async assignTransfer(transferId: string, paymentId: string, organizationId: string) {
    const transfer = await this.findTransfer(transferId, organizationId);
    if (transfer.status !== TransferStatus.UNMATCHED) {
      throw new BadRequestException('This transfer has already been handled');
    }
    const payment = await this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.session', 'session')
      .where('payment.id = :paymentId', { paymentId })
      .andWhere('session.groupId = :groupId', { groupId: transfer.groupId })
      .getOne();
    if (!payment) throw new NotFoundException('Payment not found in this group');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('That payment is not pending');
    }
    await this.markPaidFromTransfer([payment]);
    transfer.status = TransferStatus.ASSIGNED;
    transfer.paymentId = payment.id;
    return this.transfersRepo.save(transfer);
  }

  async ignoreTransfer(transferId: string, organizationId: string) {
    const transfer = await this.findTransfer(transferId, organizationId);
    transfer.status = TransferStatus.IGNORED;
    return this.transfersRepo.save(transfer);
  }

  /** Dev/demo only: pretend Payrep sent us a credit for this group. */
  async simulateTransfer(
    groupId: string,
    organizationId: string,
    input: { amount: number; senderName?: string; narration?: string },
  ) {
    const client = this.payrep;
    if (!(client instanceof MockPayrepClient)) {
      throw new BadRequestException('Simulated transfers are only available in mock mode');
    }
    const group = await this.findGroup(groupId, organizationId);
    if (!group.accountNumber) await this.provisionAccount(group);
    const payload = {
      event: 'transfer.received',
      data: {
        transactionId: `sim_${randomBytes(8).toString('hex')}`,
        accountNumber: group.accountNumber,
        amount: input.amount,
        senderName: input.senderName,
        narration: input.narration,
        receivedAt: new Date().toISOString(),
      },
    };
    const raw = JSON.stringify(payload);
    return this.handleWebhook(raw, client.sign(raw), payload);
  }

  // ── helpers ──

  private async findGroup(id: string, organizationId: string) {
    const group = await this.groupsRepo.findOne({ where: { id, organizationId } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private async findTransfer(id: string, organizationId: string) {
    const transfer = await this.transfersRepo
      .createQueryBuilder('t')
      .innerJoin('t.group', 'group')
      .where('t.id = :id', { id })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }
}

function normaliseName(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);
}

/** The billing period containing `now`. Weeks start on Monday. */
export function periodFor(type: PaymentType, now = new Date()): BillingPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (type) {
    case PaymentType.WEEKLY: {
      const start = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7));
      return {
        start: iso(start),
        label: `Week of ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      };
    }
    case PaymentType.MONTHLY: {
      const start = new Date(y, m, 1);
      return { start: iso(start), label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
    }
    case PaymentType.QUARTERLY: {
      const q = Math.floor(m / 3);
      return { start: iso(new Date(y, q * 3, 1)), label: `Q${q + 1} ${y}` };
    }
    case PaymentType.ANNUALLY:
      return { start: iso(new Date(y, 0, 1)), label: `${y} season` };
    default:
      throw new Error(`No billing period for payment type ${type}`);
  }
}
