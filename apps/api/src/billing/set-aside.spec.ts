import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { TransferStatus } from './entities/bank-transfer.entity';

/** BillingService over one transfer row, with Postgres-like conditional updates. */
function setup(status: TransferStatus) {
  const row = { id: 't1', status };
  const qb: any = { innerJoin: () => qb, where: () => qb, andWhere: () => qb, getOne: async () => ({ ...row }) };
  const transfersRepo = {
    createQueryBuilder: () => qb,
    update: async (where: any, patch: any) => {
      if (where.id !== row.id || where.status !== row.status) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    },
  };
  const service = new BillingService(
    {} as any, {} as any, {} as any, {} as any, {} as any, transfersRepo as any, {} as any,
    {} as any, {} as any,
    new MockPulseClient('secret'), {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, row };
}

describe('setting a payment aside', () => {
  it('can be undone: the payment goes back to the ones with no name', async () => {
    const { service, row } = setup(TransferStatus.UNMATCHED);
    await service.ignoreTransfer('t1', 'org');
    expect(row.status).toBe(TransferStatus.IGNORED);

    const back = await service.restoreTransfer('t1', 'org');
    expect(back.status).toBe(TransferStatus.UNMATCHED);
    expect(row.status).toBe(TransferStatus.UNMATCHED);
  });

  it("only puts back a payment that's set aside, never one already given to a player", async () => {
    const { service, row } = setup(TransferStatus.MATCHED);
    await expect(service.restoreTransfer('t1', 'org')).rejects.toThrow('isn’t set aside');
    expect(row.status).toBe(TransferStatus.MATCHED);
  });
});
