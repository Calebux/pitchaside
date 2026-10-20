import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { BankTransfer, TransferStatus } from './entities/bank-transfer.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';

/**
 * A ₦30,000 deposit that came in under the organiser's name and was placed on them as a player:
 * `credit` of it is still kept, and `paidGames` of ₦1,500 were paid from it (newest last).
 */
function setup(credit: number, paidGames: number, status = TransferStatus.MATCHED) {
  const membership: any = { groupId: 'g1', playerId: 'matt', credit: credit.toFixed(2) };
  const payments: any[] = Array.from({ length: paidGames }, (_, i) => ({
    id: `pay${i}`,
    sessionId: `s${i}`,
    playerId: 'matt',
    amount: '1500.00',
    status: PaymentStatus.PAID,
    source: 'transfer',
    session: { date: `2026-10-${String(10 + i).padStart(2, '0')}`, label: null, kind: 'game' },
  }));
  const transfer: any = { id: 't1', groupId: 'g1', playerId: 'matt', amount: '30000.00', status };
  const qb: any = {
    innerJoinAndSelect: () => qb,
    where: () => qb,
    andWhere: () => qb,
    orderBy: () => qb,
    // Newest first, like the query.
    getMany: async () => payments.filter((p) => p.status === PaymentStatus.PAID).slice().reverse(),
  };
  const tx: any = {
    findOne: async () => membership,
    getRepository: () => ({ createQueryBuilder: () => qb }),
    save: async (x: unknown) => x,
    update: async (entity: unknown, where: any, patch: any) => {
      const row = entity === BankTransfer ? transfer : payments.find((p) => p.id === where.id);
      if (!row || row.status !== where.status) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    },
  };
  const manager = { ...tx, transaction: (fn: (t: unknown) => unknown) => fn(tx) };
  const transfersRepo = { manager, update: async () => ({ affected: 1 }) };
  const paymentsService = { recalculateSessionTotal: jest.fn() };
  const service = new BillingService(
    {} as any, {} as any, {} as any, {} as any, {} as any, transfersRepo as any, {} as any,
    {} as any, {} as any,
    new MockPulseClient('secret'), paymentsService as any, {} as any, {} as any, {} as any, {} as any,
  );
  jest.spyOn(service as any, 'findTransfer').mockResolvedValue(transfer);
  return { service, membership, payments, transfer, paymentsService };
}

describe('money in that is not a player payment', () => {
  it('takes it all off what they kept when they have not spent it', async () => {
    const { service, membership, payments, transfer } = setup(30000, 0);
    expect(await service.notPlayerPreview('t1', 'org')).toMatchObject({ fromKept: 30000, reopen: [] });
    await service.classifyTransfer('t1', 'org', { category: 'organiser', note: 'My top-up' });
    expect(membership.credit).toBe('0.00');
    expect(payments).toHaveLength(0);
    expect(transfer).toMatchObject({ status: TransferStatus.OTHER, category: 'organiser', note: 'My top-up', playerId: null });
  });

  it('reopens the latest games it paid once what they kept runs out', async () => {
    // ₦27,000 kept, two games (₦3,000) already paid from it.
    const { service, membership, payments, paymentsService } = setup(27000, 2);
    const preview = await service.notPlayerPreview('t1', 'org');
    expect(preview).toMatchObject({ fromKept: 27000, backToKept: 0 });
    expect(preview.reopen.map((r) => r.paymentId)).toEqual(['pay1', 'pay0']);
    await service.classifyTransfer('t1', 'org', { category: 'organiser' });
    expect(membership.credit).toBe('0.00');
    expect(payments.map((p) => p.status)).toEqual([PaymentStatus.PENDING, PaymentStatus.PENDING]);
    expect(paymentsService.recalculateSessionTotal).toHaveBeenCalledTimes(2);
  });

  it('reopens the game the transfer itself paid before newer ones', async () => {
    // A ₦1,500 transfer that paid the older game; a newer game was paid by another transfer.
    const { service, transfer } = setup(0, 2);
    transfer.amount = '1500.00';
    transfer.paymentId = 'pay0';
    const preview = await service.notPlayerPreview('t1', 'org');
    expect(preview.reopen.map((r) => r.paymentId)).toEqual(['pay0']);
  });

  it('gives back what reopening a whole game takes over the amount', async () => {
    // ₦29,000 kept: ₦1,000 more to cover, so one ₦1,500 game reopens and ₦500 stays theirs.
    const { service, membership } = setup(29000, 1);
    expect(await service.notPlayerPreview('t1', 'org')).toMatchObject({ fromKept: 29000, backToKept: 500 });
    await service.classifyTransfer('t1', 'org', { category: 'organiser' });
    expect(membership.credit).toBe('500.00');
  });

  it('takes the deposit back from their extra first, then the game it paid', async () => {
    // ₦30,000 under their name: ₦1,500 paid a game, ₦28,500 waited as extra.
    const { service, membership, payments } = setup(0, 1);
    membership.extra = '28500.00';
    const preview = await service.notPlayerPreview('t1', 'org');
    expect(preview).toMatchObject({ fromExtra: 28500, fromKept: 0 });
    expect(preview.reopen.map((r) => r.paymentId)).toEqual(['pay0']);
    await service.classifyTransfer('t1', 'org', { category: 'organiser' });
    expect(membership.extra).toBe('0.00');
    expect(payments[0].status).toBe(PaymentStatus.PENDING);
  });

  it('changes nothing for a payment nobody was named for', async () => {
    const { service, membership, transfer } = setup(800, 1, TransferStatus.UNMATCHED);
    expect(await service.notPlayerPreview('t1', 'org')).toMatchObject({ fromKept: 0, reopen: [] });
    await service.classifyTransfer('t1', 'org', { category: 'sponsor' });
    expect(membership.credit).toBe('800.00');
    expect(transfer.status).toBe(TransferStatus.OTHER);
  });
});
