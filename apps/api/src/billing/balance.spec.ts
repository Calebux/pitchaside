import { UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { Group } from '../groups/entities/group.entity';

/** BillingService with in-memory stand-ins for what the balance and webhook paths touch. */
function setup(bankBalance: number | null, recordedIn = 0) {
  const group = { id: 'g1', name: 'FlowVault', organizationId: 'org1', accountNumber: '9999268301' } as Group;
  const sum = (value: number) => () => {
    const qb: any = { select: () => qb, where: () => qb, andWhere: () => qb, getRawOne: async () => ({ totalIn: value, totalOut: 0 }) };
    return qb;
  };
  const groupsRepo = { findOne: jest.fn(async () => group), exists: jest.fn(async () => false) };
  const pulse = new MockPulseClient('secret');
  jest.spyOn(pulse, 'getBalance').mockResolvedValue(bankBalance);

  const service = new BillingService(
    groupsRepo as any, {} as any, {} as any, {} as any, {} as any,
    { createQueryBuilder: sum(recordedIn) } as any,
    { createQueryBuilder: sum(0) } as any,
    pulse, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, pulse };
}

describe('group balance', () => {
  it("uses what the bank holds as the available balance, and shows what we haven't recorded", async () => {
    const { service } = setup(198);
    const b = await service.getGroupBalance('g1', 'org1');

    expect(b).toMatchObject({ recorded: 0, bankBalance: 198, available: 198, unrecorded: 198, lastNotice: null });
  });

  it('falls back to our records when the bank balance is unknown', async () => {
    const { service } = setup(null, 3000);
    const b = await service.getGroupBalance('g1', 'org1');

    expect(b).toMatchObject({ recorded: 3000, bankBalance: null, available: 3000, unrecorded: 0 });
  });

  it('remembers a rejected notification for the account it was about', async () => {
    const { service, pulse } = setup(198);
    const payload = { event: 'transfer.completed', data: { reference: 'FT1', amount: 198, credit_account: '9999268301' } };
    jest.spyOn(pulse, 'parseWebhook').mockReturnValue({
      providerTransactionId: 'FT1', accountNumber: '9999268301', amount: 198, receivedAt: new Date(), raw: payload,
    });

    await expect(service.handleWebhook(JSON.stringify(payload), 'bad-signature', payload)).rejects.toThrow(UnauthorizedException);

    const b = await service.getGroupBalance('g1', 'org1');
    expect(b.lastNotice).toMatchObject({ outcome: 'rejected' });
  });
});
