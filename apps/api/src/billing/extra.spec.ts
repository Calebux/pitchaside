import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { payableNow } from '../payments/credit';

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Femi has extra; Ada owes games (`adaDues`, dated). */
function setup(femiExtra: number, adaDues: { amount: number; date: string }[], adaCredit = 0) {
  const members: Record<string, any> = {
    femi: { groupId: 'g1', playerId: 'femi', credit: '0.00', extra: femiExtra.toFixed(2) },
    ada: { groupId: 'g1', playerId: 'ada', credit: adaCredit.toFixed(2), extra: '0.00' },
  };
  const payments: any[] = adaDues.map((d, i) => ({ id: `ada${i}`, sessionId: `s${i}`, playerId: 'ada', amount: String(d.amount), status: PaymentStatus.PENDING, session: { date: d.date } }));
  let forPlayer = 'ada';
  const qb: any = {
    innerJoinAndSelect: () => qb,
    where: () => qb,
    andWhere: (_s: string, p: any) => {
      if (p?.playerId) forPlayer = p.playerId;
      return qb;
    },
    orderBy: () => qb,
    getMany: async () => payments.filter((p) => p.playerId === forPlayer && p.status === PaymentStatus.PENDING),
  };
  const tx: any = {
    findOne: async (_e: unknown, o: any) => members[o.where.playerId] ?? null,
    getRepository: () => ({ createQueryBuilder: () => qb }),
    save: async (x: unknown) => x,
  };
  const manager = { ...tx, transaction: (fn: (t: unknown) => unknown) => fn(tx) };
  const paymentsService = { recalculateSessionTotal: jest.fn(), sendReceipts: jest.fn() };
  const service = new BillingService(
    {} as any, { manager } as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    {} as any, {} as any,
    new MockPulseClient('secret'), paymentsService as any, { later: jest.fn() } as any, {} as any, {} as any, {} as any,
  );
  jest.spyOn(service as any, 'findGroup').mockResolvedValue({ id: 'g1' });
  return { service, members, payments };
}

describe('sorting extra money', () => {
  it('pays what the other player owes now, and the rest stays to sort', async () => {
    const { service, members, payments } = setup(3000, [{ amount: 1500, date: day(-3) }]);
    expect(await service.giveExtraPreview('g1', 'femi', 'ada', 'org1')).toMatchObject({ move: 1500, left: 1500, towards: null });
    await service.giveExtra('g1', 'femi', 'ada', 'org1');
    expect(payments[0].status).toBe(PaymentStatus.PAID);
    expect(members.femi.extra).toBe('1500.00');
    expect(members.ada.extra).toBe('0.00');
  });

  it("doesn't pay the other player's games beyond their next one", async () => {
    const { service, payments, members } = setup(4500, [
      { amount: 1500, date: day(4) },
      { amount: 1500, date: day(11) },
    ]);
    await service.giveExtra('g1', 'femi', 'ada', 'org1');
    expect(payments.map((p) => p.status)).toEqual([PaymentStatus.PAID, PaymentStatus.PENDING]);
    expect(members.femi.extra).toBe('3000.00');
  });

  it('less than they owe is a part payment towards their game', async () => {
    const { service, members } = setup(1000, [{ amount: 1500, date: day(-1) }]);
    expect(await service.giveExtraPreview('g1', 'femi', 'ada', 'org1')).toMatchObject({ move: 1000, towards: { paidSoFar: 1000 } });
    await service.giveExtra('g1', 'femi', 'ada', 'org1');
    expect(members.ada.credit).toBe('1000.00');
    expect(members.femi.extra).toBe('0.00');
  });

  it('refuses when the other player owes nothing that can be paid now', async () => {
    const { service } = setup(1500, []);
    await expect(service.giveExtra('g1', 'femi', 'ada', 'org1')).rejects.toThrow('don’t owe anything');
  });

  it('refuses giving it to the same player', async () => {
    const { service } = setup(1500, []);
    await expect(service.giveExtra('g1', 'femi', 'femi', 'org1')).rejects.toThrow('Keep it for their next game');
  });
});

describe('extra waiting for a player', () => {
  it('moves apart from the sender’s money with the note, and pays nothing', async () => {
    const { service, members, payments } = setup(3000, [{ amount: 1500, date: day(-3) }]);
    await service.holdExtra('g1', 'femi', 'org1', ' Kunle’s friend ');
    expect(members.femi).toMatchObject({ extra: '0.00', waiting: '3000.00', waitingNote: 'Kunle’s friend' });
    expect(payments[0].status).toBe(PaymentStatus.PENDING);
    await expect(service.holdExtra('g1', 'femi', 'org1')).rejects.toThrow('no extra left');
  });

  it('later pays the right player, and only what they owe now stays given', async () => {
    const { service, members, payments } = setup(3000, [{ amount: 1500, date: day(-3) }]);
    await service.holdExtra('g1', 'femi', 'org1', 'Not registered');
    expect(await service.giveExtraPreview('g1', 'femi', 'ada', 'org1', 'waiting')).toMatchObject({ move: 1500, left: 1500 });
    await service.giveExtra('g1', 'femi', 'ada', 'org1', 'waiting');
    expect(payments[0].status).toBe(PaymentStatus.PAID);
    expect(members.femi).toMatchObject({ extra: '0.00', waiting: '1500.00', waitingNote: 'Not registered' });
  });

  it('can be put back with the sender’s extra', async () => {
    const { service, members } = setup(2000, []);
    await service.holdExtra('g1', 'femi', 'org1');
    await service.releaseWaiting('g1', 'femi', 'org1');
    expect(members.femi).toMatchObject({ extra: '2000.00', waiting: '0.00', waitingNote: null });
    await expect(service.releaseWaiting('g1', 'femi', 'org1')).rejects.toThrow('Nothing is waiting');
  });
});

describe('payableNow', () => {
  const due = (date: string) => ({ session: { date } }) as unknown as Payment;
  it('keeps played games and the one next game', () => {
    const list = [due('2026-01-01'), due('2026-01-10'), due('2026-01-17'), due('2026-01-24')];
    expect(payableNow(list, '2026-01-12')).toEqual(list.slice(0, 3));
  });
  it("today's game counts as played", () => {
    const list = [due('2026-01-12'), due('2026-01-19'), due('2026-01-26')];
    expect(payableNow(list, '2026-01-12')).toEqual(list.slice(0, 2));
  });
});
