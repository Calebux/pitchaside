import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';

/** An incoming transfer is saved for exactly what the bank reported: nothing is added on top. */
describe('incoming transfer amount', () => {
  it.each([1500, 3000, 500, 50])('saves ₦%i as ₦%i', async (sent) => {
    const saved: any[] = [];
    const qb: any = { where: () => qb, getOne: async () => null };
    const groupsRepo = { createQueryBuilder: () => qb };
    const transfersRepo = {
      findOne: async () => null,
      create: (x: unknown) => x,
      save: async (x: any) => (saved.push(x), x),
    };
    const service = new BillingService(
      groupsRepo as any, {} as any, {} as any, {} as any, {} as any, transfersRepo as any, {} as any,
      {} as any, {} as any,
      new MockPulseClient('secret'), {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    await service.recordTransfer({ providerTransactionId: `t${sent}`, accountNumber: '0123456789', amount: sent, receivedAt: new Date(), raw: {} } as any);

    expect(saved[0].amount).toBe(sent);
  });
});
