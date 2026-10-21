import { ConflictException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { releaseToExtra } from '../payments/credit';
import { GroupsService } from '../groups/groups.service';

/** An in-memory member per player; the transaction hands back the same objects. */
function manager(credits: Record<string, number>) {
  const memberships: Record<string, any> = {};
  for (const [playerId, credit] of Object.entries(credits)) {
    memberships[playerId] = { groupId: 'g1', playerId, credit: credit.toFixed(2) };
  }
  const tx = { findOne: async (_e: unknown, o: any) => memberships[o.where.playerId] ?? null, save: async (x: unknown) => x };
  return { memberships, manager: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as any };
}

const due = (playerId: string, status: PaymentStatus, source?: string): Payment =>
  ({ id: `pay-${playerId}`, sessionId: 's1', playerId, amount: 1000, status, source }) as unknown as Payment;

describe('releaseToExtra', () => {
  it('puts dues paid by transfer in extra to sort and leaves cash and unpaid dues alone', async () => {
    const { memberships, manager: m } = manager({ p1: 0, p2: 0, p3: 50 });
    const credited = await releaseToExtra(m, 'g1', [
      due('p1', PaymentStatus.PAID, 'transfer'),
      due('p2', PaymentStatus.PAID, 'manual'),
      due('p3', PaymentStatus.PENDING),
    ]);

    expect(credited).toEqual(['p1']);
    expect(memberships.p1).toMatchObject({ credit: '0.00', extra: '1000.00' });
    expect(memberships.p2.credit).toBe('0.00');
    expect(memberships.p3.credit).toBe('50.00');
  });

  it('gives back only the transfer part of a part-paid due that was marked paid by hand', async () => {
    const { memberships, manager: m } = manager({ p1: 0 });
    const handPaid = { ...due('p1', PaymentStatus.PAID, 'manual'), amount: 1500, fromCredit: '1000.00' } as unknown as Payment;

    const credited = await releaseToExtra(m, 'g1', [handPaid]);

    expect(credited).toEqual(['p1']);
    expect(memberships.p1.credit).toBe('1000.00');
    expect(handPaid.fromCredit).toBe('0');
  });

  it("skips a player who is no longer a member", async () => {
    const { manager: m } = manager({});
    await expect(releaseToExtra(m, 'g1', [due('gone', PaymentStatus.PAID, 'transfer')])).resolves.toEqual([]);
  });
});

describe('releaseTransferDues', () => {
  function setup() {
    const { memberships, manager: m } = manager({ p1: 0 });
    const paymentsRepo = { manager: m, save: jest.fn(async (x: unknown) => x) };
    const paymentsService = { recalculateSessionTotal: jest.fn() };
    const service = new BillingService(
      {} as any, {} as any, {} as any, paymentsRepo as any, {} as any, {} as any, {} as any,
      {} as any, {} as any,
      new MockPulseClient('secret'), paymentsService as any, {} as any, {} as any, {} as any, {} as any,
    );
    const applyCredits = jest.spyOn(service, 'applyCredits').mockResolvedValue(undefined);
    return { service, memberships, paymentsRepo, paymentsService, applyCredits };
  }

  it('on cancel, reopens the paid due and moves the money to extra to sort', async () => {
    const { service, memberships, paymentsService, applyCredits } = setup();
    const payment = due('p1', PaymentStatus.PAID, 'transfer');

    await service.releaseTransferDues({ groupId: 'g1', payments: [payment] }, { reopen: true });

    expect(memberships.p1).toMatchObject({ credit: '0.00', extra: '1000.00' });
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.source).toBeNull();
    expect(paymentsService.recalculateSessionTotal).toHaveBeenCalledWith('s1');
    expect(applyCredits).toHaveBeenCalledWith('g1', ['p1']);
  });

  it('on delete, only gives the member the money back to sort', async () => {
    const { service, memberships, paymentsRepo, applyCredits } = setup();

    await service.releaseTransferDues({ groupId: 'g1', payments: [due('p1', PaymentStatus.PAID, 'transfer')] }, { reopen: false });

    expect(memberships.p1).toMatchObject({ credit: '0.00', extra: '1000.00' });
    expect(paymentsRepo.save).not.toHaveBeenCalled();
    expect(applyCredits).toHaveBeenCalledWith('g1', ['p1']);
  });

  it('does nothing for a game paid in cash', async () => {
    const { service, applyCredits } = setup();
    await service.releaseTransferDues({ groupId: 'g1', payments: [due('p1', PaymentStatus.PAID, 'manual')] }, { reopen: true });
    expect(applyCredits).not.toHaveBeenCalled();
  });
  it('on cancel, reopens a part-paid due marked paid by hand and gives back the transfer part', async () => {
    const { service, memberships, paymentsRepo } = setup();
    const handPaid = { ...due('p1', PaymentStatus.PAID, 'manual'), amount: 1500, fromCredit: '1000.00' } as unknown as Payment;

    await service.releaseTransferDues({ groupId: 'g1', payments: [handPaid] }, { reopen: true });

    expect(memberships.p1.credit).toBe('1000.00');
    expect(handPaid.status).toBe(PaymentStatus.PENDING);
    expect(paymentsRepo.save).toHaveBeenCalledWith([handPaid]);
  });
});

describe('GroupsService money guards', () => {
  function setup({ credit = '0.00', available = 0, byTransfer = 0 } = {}) {
    const order: string[] = [];
    const groupsRepo = { findOne: async () => ({ id: 'g1' }), remove: jest.fn() };
    const membershipsRepo = {
      findOne: async () => ({ groupId: 'g1', playerId: 'p1', credit }),
      delete: jest.fn(async () => order.push('delete')),
    };
    const billing = { getGroupBalance: async () => ({ available }) };
    const rsvp = {
      leavingPreview: async () => ({ games: 2, byTransfer, cash: [] }),
      takeOffGamesAhead: jest.fn(async () => order.push('off games')),
    };
    const crypto = {};
    const service = new GroupsService(groupsRepo as any, membershipsRepo as any, billing as any, crypto as any, rsvp as any);
    return { service, groupsRepo, membershipsRepo, rsvp, order };
  }

  it('takes them off games still to come before they leave, so transfer money can still be put back', async () => {
    const { service, order } = setup();
    await service.removeMember('g1', 'p1', 'org1');
    expect(order).toEqual(['off games', 'delete']);
  });

  it('counts what they paid by transfer for games to come as money that goes with them', async () => {
    const { service, membershipsRepo, rsvp } = setup({ byTransfer: 1500 });
    await expect(service.removeMember('g1', 'p1', 'org1')).rejects.toThrow('₦1,500');
    expect(rsvp.takeOffGamesAhead).not.toHaveBeenCalled();
    expect(membershipsRepo.delete).not.toHaveBeenCalled();
    await expect(service.leavingPreview('g1', 'p1', 'org1')).resolves.toMatchObject({ games: 2, byTransfer: 1500, held: 0, dropped: 1500 });
  });

  it("won't remove a member holding credit unless forced", async () => {
    const { service, membershipsRepo } = setup({ credit: '300.00' });
    await expect(service.removeMember('g1', 'p1', 'org1')).rejects.toThrow(ConflictException);
    expect(membershipsRepo.delete).not.toHaveBeenCalled();

    await service.removeMember('g1', 'p1', 'org1', true);
    expect(membershipsRepo.delete).toHaveBeenCalledWith({ groupId: 'g1', playerId: 'p1' });
  });

  it('removes a member without credit straight away', async () => {
    const { service, membershipsRepo } = setup();
    await service.removeMember('g1', 'p1', 'org1');
    expect(membershipsRepo.delete).toHaveBeenCalled();
  });

  it("won't delete a group whose account still holds money", async () => {
    const { service, groupsRepo } = setup({ available: 2500 });
    await expect(service.remove('g1', 'org1')).rejects.toThrow(ConflictException);
    expect(groupsRepo.remove).not.toHaveBeenCalled();
  });

  it('deletes an empty group', async () => {
    const { service, groupsRepo } = setup();
    await service.remove('g1', 'org1');
    expect(groupsRepo.remove).toHaveBeenCalled();
  });

});

describe('repayCalledOff', () => {
  function setup(extra: number) {
    const m: any = { groupId: 'g1', playerId: 'p1', credit: '0.00', extra: extra.toFixed(2) };
    const tx = { findOne: async () => m, save: async (x: unknown) => x };
    const membershipsRepo = { manager: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
    const paymentsService = { recalculateSessionTotal: jest.fn() };
    const service = new BillingService(
      {} as any, membershipsRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any,
      new MockPulseClient('secret'), paymentsService as any, {} as any, {} as any, {} as any, {} as any,
    );
    return { service, m };
  }

  it('a game back on is paid again from the money it gave back, if still there', async () => {
    const { service, m } = setup(1000);
    const p = due('p1', PaymentStatus.PENDING);
    await service.repayCalledOff({ groupId: 'g1', payments: [p] });
    expect(p).toMatchObject({ status: PaymentStatus.PAID, source: 'transfer' });
    expect(m.extra).toBe('0.00');
  });

  it("leaves the due unpaid when that money has been sorted since", async () => {
    const { service, m } = setup(400);
    const p = due('p1', PaymentStatus.PENDING);
    await service.repayCalledOff({ groupId: 'g1', payments: [p] });
    expect(p.status).toBe(PaymentStatus.PENDING);
    expect(m.extra).toBe('400.00');
  });
});
