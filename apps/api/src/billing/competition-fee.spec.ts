import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { TeamRegistrationStatus } from '../competitions/entities/competition-team.entity';

/**
 * A team registering for a ₦20,000 tournament with code CPA1B2C3D4. `before` is what earlier
 * transfers with that code already brought in; the new one is `amount`.
 */
function setup(amount: number, before = 0, { duplicate = false, entryFee = 20000 } = {}) {
  const comp: any = { id: 'c1', name: 'Lagos Cup', entryFee: entryFee.toFixed(2), accountNumber: '9900000001' };
  const team: any = { id: 'team1', competitionId: 'c1', paymentRef: 'CPA1B2C3D4', registrationStatus: TeamRegistrationStatus.PENDING_PAYMENT };
  const qb = (result: () => unknown) => {
    const q: any = { select: () => q, where: () => q, andWhere: () => q, getExists: result, getOne: result, getRawOne: result };
    return q;
  };
  const groupsRepo = { createQueryBuilder: () => qb(async () => false) };
  const competitionsRepo = { createQueryBuilder: () => qb(async () => comp) };
  const transfersRepo = { createQueryBuilder: () => qb(async () => ({ total: String(before + (duplicate ? 0 : amount)) })) };
  const competitionTeamsRepo = { findOne: async () => team, save: jest.fn(async (x: unknown) => x) };
  const pulse = new MockPulseClient('secret');
  const service = new BillingService(
    groupsRepo as any, {} as any, {} as any, {} as any, {} as any, transfersRepo as any, {} as any,
    competitionsRepo as any, competitionTeamsRepo as any,
    pulse, {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  jest.spyOn(pulse, 'verifyWebhook').mockReturnValue(true);
  jest.spyOn(pulse, 'parseWebhook').mockReturnValue({
    providerTransactionId: 'txn1', accountNumber: comp.accountNumber, amount, narration: 'Lagos Cup CPA1B2C3D4', receivedAt: new Date(),
  } as any);
  jest.spyOn(service, 'recordTransfer').mockResolvedValue(duplicate ? { received: true, duplicate: true, status: 'unmatched' } as any : { received: true, status: 'unmatched' } as any);
  const pay = () => service.handleWebhook('{}', 'sig', {});
  return { pay, team, competitionTeamsRepo };
}

describe('tournament entry fee', () => {
  it('does not confirm a team that sent less than the fee', async () => {
    const { pay, team } = setup(50);
    await pay();
    expect(team.registrationStatus).toBe(TeamRegistrationStatus.PENDING_PAYMENT);
  });

  it('confirms once the fee is covered', async () => {
    const { pay, team } = setup(20000);
    await pay();
    expect(team.registrationStatus).toBe(TeamRegistrationStatus.CONFIRMED);
    expect(team.paidAt).toBeInstanceOf(Date);
  });

  it('adds part payments up', async () => {
    const { pay, team } = setup(8000, 12000);
    await pay();
    expect(team.registrationStatus).toBe(TeamRegistrationStatus.CONFIRMED);
  });

  it('does not act on a retried webhook', async () => {
    const { pay, competitionTeamsRepo } = setup(20000, 0, { duplicate: true });
    await pay();
    expect(competitionTeamsRepo.save).not.toHaveBeenCalled();
  });

  it('confirms any payment with the code for a free tournament', async () => {
    const { pay, team } = setup(100, 0, { entryFee: 0 });
    await pay();
    expect(team.registrationStatus).toBe(TeamRegistrationStatus.CONFIRMED);
  });
});
