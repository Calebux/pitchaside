import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { GroupKeptMoney } from './entities/group-kept-money.entity';

/**
 * "Keep it for the group": the member's extra goes to ₦0 and a record says how much and why.
 * Credit (money kept for their games) and money waiting for someone else are never touched.
 */
function setup(member: { extra: string; credit?: string; waiting?: string } | null) {
  const m = member ? { groupId: 'g1', playerId: 'ada', credit: '500.00', waiting: '1000.00', ...member } : null;
  const saved: any[] = [];
  const tx = {
    findOne: jest.fn(async () => m),
    save: jest.fn(async (row: any) => (saved.push(row), row)),
    create: jest.fn((_e: unknown, row: any) => ({ __entity: _e, ...row })),
  };
  const membershipsRepo = { manager: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
  const groupsRepo = { findOne: jest.fn(async () => ({ id: 'g1', organizationId: 'org' })) };
  const service = new BillingService(
    groupsRepo as any, membershipsRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    {} as any, {} as any,
    new MockPulseClient('secret'), {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, m, saved, tx };
}

describe('keepForGroup', () => {
  it('clears the extra and records how much, why and by whom', async () => {
    const { service, m, saved } = setup({ extra: '7500.00' });
    await expect(service.keepForGroup('g1', 'ada', 'org', { reason: 'unreachable', recordedBy: 'u1' })).resolves.toEqual({ kept: 7500 });
    expect(m!.extra).toBe('0.00');
    const record = saved.find((r) => r.__entity === GroupKeptMoney);
    expect(record).toMatchObject({ groupId: 'g1', playerId: 'ada', amount: '7500.00', reason: 'unreachable', note: null, recordedBy: 'u1' });
  });

  it("never touches the member's credit or money waiting for someone else", async () => {
    const { service, m } = setup({ extra: '2000.00' });
    await service.keepForGroup('g1', 'ada', 'org', { reason: 'player_agreed' });
    expect(m!.credit).toBe('500.00');
    expect(m!.waiting).toBe('1000.00');
  });

  it('needs a few words for "other", and keeps them', async () => {
    const { service, saved } = setup({ extra: '1500.00' });
    await expect(service.keepForGroup('g1', 'ada', 'org', { reason: 'other' })).rejects.toThrow('Say in a few words');
    await service.keepForGroup('g1', 'ada', 'org', { reason: 'other', note: '  Paid  for the pitch  ' });
    expect(saved.find((r) => r.__entity === GroupKeptMoney).note).toBe('Paid for the pitch');
  });

  it('turns down a reason that isn’t on the list', async () => {
    const { service } = setup({ extra: '1500.00' });
    await expect(service.keepForGroup('g1', 'ada', 'org', { reason: 'because' as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does nothing when there is no extra left (e.g. already sorted on another phone)', async () => {
    const { service, saved } = setup({ extra: '0.00' });
    await expect(service.keepForGroup('g1', 'ada', 'org', { reason: 'unreachable' })).rejects.toThrow('no extra left');
    expect(saved).toHaveLength(0);
  });

  it('refuses a player who isn’t in the group', async () => {
    const { service } = setup(null);
    await expect(service.keepForGroup('g1', 'zed', 'org', { reason: 'unreachable' })).rejects.toThrow("isn't in this group");
  });
});
