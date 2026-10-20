import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { BankTransfer } from '../billing/entities/bank-transfer.entity';

/** Two games for one player in one group; the transaction applies updates like Postgres would. */
function setup(fromAmount: number, toAmount: number, credit = 0, fromSource = 'transfer') {
  const rows: Record<string, any> = {
    from: { id: 'from', playerId: 'p1', sessionId: 's1', amount: String(fromAmount), status: PaymentStatus.PAID, source: fromSource, paidAt: new Date('2026-10-17'), markedBy: 'pulse', session: { groupId: 'g1', status: 'completed' } },
    to: { id: 'to', playerId: 'p1', sessionId: 's2', amount: String(toAmount), status: PaymentStatus.PENDING, session: { groupId: 'g1', status: 'upcoming' } },
  };
  const transfers = [{ id: 't1', paymentId: 'from' }];
  const membership = { groupId: 'g1', playerId: 'p1', credit: credit.toFixed(2) };
  const tx = {
    update: async (entity: unknown, where: any, patch: any) => {
      if (entity === BankTransfer) {
        const hit = transfers.filter((t) => t.paymentId === where.paymentId);
        hit.forEach((t) => Object.assign(t, patch));
        return { affected: hit.length };
      }
      const row = rows[where.id];
      if (entity !== Payment || !row || row.status !== where.status) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    },
    findOne: async () => membership,
    save: async (x: unknown) => x,
  };
  const qbFor = (id: string) => ({ innerJoinAndSelect: () => qb, innerJoin: () => qb, where: (_: string, p: any) => ((qb.id = p.id), qb), andWhere: () => qb, getOne: async () => ({ ...rows[qb.id] }) });
  const qb: any = qbFor('');
  const paymentsRepo = { createQueryBuilder: () => qb, find: async () => [], manager: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
  const sessionsRepo = { update: jest.fn() };
  const service = new PaymentsService(paymentsRepo as any, sessionsRepo as any, {} as any);
  return { service, rows, transfers, membership };
}

describe('moving a payment to another game', () => {
  it('pays the other game with the transfer and puts this one back to unpaid', async () => {
    const { service, rows, transfers, membership } = setup(1500, 1500);

    await expect(service.moveToGame('from', 'to', 'org')).resolves.toMatchObject({ kept: 0 });

    expect(rows.from).toMatchObject({ status: PaymentStatus.PENDING, source: null });
    expect(rows.to).toMatchObject({ status: PaymentStatus.PAID, source: 'transfer' });
    expect(transfers[0].paymentId).toBe('to');
    expect(membership.credit).toBe('0.00');
  });

  it('the difference waits as extra to sort when the other game costs less', async () => {
    const { service, membership } = setup(1500, 1000, 200);
    await expect(service.moveToGame('from', 'to', 'org')).resolves.toMatchObject({ kept: 500 });
    expect(membership).toMatchObject({ credit: '200.00', extra: '500.00' });
  });

  it("won't move onto a game that costs more than the payment", async () => {
    const { service, rows } = setup(1000, 1500);
    await expect(service.moveToGame('from', 'to', 'org')).rejects.toThrow('less than the ₦1,500 that game costs');
    expect(rows.to.status).toBe(PaymentStatus.PENDING);
  });

  it("won't move a payment marked paid by hand", async () => {
    const { service } = setup(1500, 1500, 0, 'manual');
    await expect(service.moveToGame('from', 'to', 'org')).rejects.toThrow('Only a payment that came by transfer');
  });
});
