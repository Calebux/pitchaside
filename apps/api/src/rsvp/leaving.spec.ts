import { RsvpService } from './rsvp.service';
import { RsvpStatus } from './entities/rsvp.entity';
import { PaymentStatus } from '../payments/entities/payment.entity';
import { SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { localDate } from '../common/time.util';

/** A player removed from a group comes off the games still to come, and only those. */
describe('RsvpService: leaving a group', () => {
  const today = localDate(0);
  const group = { id: 'g1', name: 'Ballers', targetPlayers: 2, requireRsvp: true, kickoffTime: null, organizationId: 'o1' };
  const game = (id: string, date: string, kickoffTime: string | null = null) => ({
    id,
    groupId: 'g1',
    date,
    kickoffTime,
    status: SessionStatus.UPCOMING,
    kind: SessionKind.GAME,
    group,
  });

  function setup(sessions: ReturnType<typeof game>[], payments: any[], rsvps: any[], membership = { groupId: 'g1', playerId: 'p1', extra: '0', credit: '0' }) {
    const removedPayments: any[] = [];
    const removedRsvps: any[] = [];
    const saved: any[] = [];
    const tx = {
      findOne: async () => membership,
      save: async (m: any) => saved.push({ ...m }),
    };
    const paymentsRepo = {
      find: async ({ where }: any) => payments.filter((p) => where.sessionId.value.includes(p.sessionId) && p.playerId === where.playerId),
      findOne: async ({ where }: any) => payments.find((p) => p.sessionId === where.sessionId && p.playerId === where.playerId) ?? null,
      remove: async (p: any) => removedPayments.push(p),
      save: async (p: any) => p,
      create: (p: any) => p,
      manager: { transaction: (fn: any) => fn(tx) },
    };
    const rsvpRepo = {
      find: async ({ where }: any) => rsvps.filter((r) => where.sessionId.value.includes(r.sessionId) && r.playerId === where.playerId),
      findOne: async ({ where }: any) =>
        rsvps.find((r) => r.sessionId === where.sessionId && (where.playerId ? r.playerId === where.playerId : r.status === where.status)) ?? null,
      count: async ({ where }: any) => rsvps.filter((r) => r.sessionId === where.sessionId && r.status === where.status && !removedRsvps.includes(r)).length,
      remove: async (r: any) => {
        removedRsvps.push(r);
        rsvps.splice(rsvps.indexOf(r), 1);
      },
      save: async (r: any) => r,
    };
    const sessionsRepo = { find: async () => sessions };
    const paymentsSvc = { recalculateSessionTotal: jest.fn() };
    const notifications = { later: jest.fn(), notifyPlayers: jest.fn() };
    const billing = { applyCredits: jest.fn() };
    const svc = new RsvpService(rsvpRepo as any, sessionsRepo as any, {} as any, {} as any, paymentsRepo as any, paymentsSvc as any, notifications as any, billing as any);
    return { svc, removedPayments, removedRsvps, saved, paymentsSvc, membership };
  }

  it('comes off games still to come, and leaves ones already kicked off today alone', async () => {
    const later = localDate(3);
    const sessions = [game('kicked-off', today, '00:00'), game('later', later)];
    const payments = [
      { sessionId: 'kicked-off', playerId: 'p1', status: PaymentStatus.PENDING, amount: '1500', source: null },
      { sessionId: 'later', playerId: 'p1', status: PaymentStatus.PENDING, amount: '1500', source: null },
    ];
    const { svc, removedPayments } = setup(sessions, payments, []);
    await svc.takeOffGamesAhead('g1', 'p1');
    expect(removedPayments.map((p) => p.sessionId)).toEqual(['later']);
  });

  it('puts what they paid by transfer back with their money, before the membership goes', async () => {
    const payments = [{ sessionId: 's1', playerId: 'p1', status: PaymentStatus.PAID, amount: '1500', source: 'transfer' }];
    const { svc, saved } = setup([game('s1', localDate(2))], payments, []);
    await expect(svc.leavingPreview('g1', 'p1')).resolves.toMatchObject({ games: 1, byTransfer: 1500, cash: [] });
    await svc.takeOffGamesAhead('g1', 'p1');
    expect(saved[0].extra).toBe('1500.00');
  });

  it('names cash they paid ahead, for the organiser to give back', async () => {
    const date = localDate(5);
    const payments = [{ sessionId: 's1', playerId: 'p1', status: PaymentStatus.PAID, amount: '2000', source: 'manual' }];
    const { svc } = setup([game('s1', date)], payments, []);
    await expect(svc.leavingPreview('g1', 'p1')).resolves.toMatchObject({ games: 1, byTransfer: 0, cash: [{ date, amount: 2000 }] });
  });

  it('drops their reply, waitlist too, and gives a place they held to the first person waiting', async () => {
    const rsvps = [
      { sessionId: 's1', playerId: 'p1', status: RsvpStatus.IN, statusAt: new Date(1) },
      { sessionId: 's1', playerId: 'p2', status: RsvpStatus.IN, statusAt: new Date(2) },
      { sessionId: 's1', playerId: 'p3', status: RsvpStatus.WAITLIST, statusAt: new Date(3) },
      { sessionId: 's2', playerId: 'p1', status: RsvpStatus.WAITLIST, statusAt: new Date(4) },
    ];
    const { svc, removedRsvps } = setup([game('s1', localDate(1)), game('s2', localDate(8))], [], rsvps);
    await svc.takeOffGamesAhead('g1', 'p1');
    expect(removedRsvps.map((r) => r.sessionId)).toEqual(['s1', 's2']);
    expect(rsvps.find((r) => r.playerId === 'p3')?.status).toBe(RsvpStatus.IN);
  });

  it('does nothing for games they were never on', async () => {
    const { svc, paymentsSvc } = setup([game('s1', localDate(1))], [], []);
    await svc.takeOffGamesAhead('g1', 'p1');
    expect(paymentsSvc.recalculateSessionTotal).not.toHaveBeenCalled();
  });
});
