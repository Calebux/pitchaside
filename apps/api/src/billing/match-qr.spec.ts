import { BillingService } from './billing.service';
import { MockPulseClient } from './pulse/mock-pulse.client';
import { SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { PaymentStatus } from '../payments/entities/payment.entity';
import { localDate } from '../common/time.util';

/** Joining from a game's QR code: in a group without replies, they're put on that game. */
describe("joining from a game's QR code", () => {
  function setup(over: { requireRsvp?: boolean; game?: any; onGame?: boolean; paymentType?: string } = {}) {
    const game = over.game === undefined ? { id: 's1', groupId: 'g1', kind: SessionKind.GAME, status: SessionStatus.UPCOMING, date: localDate(0) } : over.game;
    const saved: any[] = [];
    const sessionsRepo = { findOne: async () => game };
    const paymentsRepo = { findOne: async () => (over.onGame ? { id: 'p1' } : null), create: (x: any) => x, save: async (x: any) => saved.push(x) };
    const paymentsService = { recalculateSessionTotal: jest.fn() };
    const service = new BillingService(
      {} as any, {} as any, sessionsRepo as any, paymentsRepo as any, {} as any, {} as any, {} as any,
      {} as any, {} as any,
      new MockPulseClient('secret'), paymentsService as any, {} as any, {} as any, {} as any, {} as any,
    );
    const credits = jest.spyOn(service, 'applyCredits').mockResolvedValue(undefined as never);
    const group = { id: 'g1', requireRsvp: over.requireRsvp ?? false, paymentType: over.paymentType ?? 'per_session', feePerPlayer: '1500' };
    const put = () => (service as any).putOnGame(group, 'ada', 's1') as Promise<boolean>;
    return { put, saved, credits };
  }

  it("puts a new member on that game at the group's price", async () => {
    const { put, saved, credits } = setup();
    expect(await put()).toBe(true);
    expect(saved[0]).toMatchObject({ sessionId: 's1', playerId: 'ada', amount: 1500 });
    expect(credits).toHaveBeenCalledWith('g1', ['ada']);
  });

  it('in a dues group the game is covered by their dues', async () => {
    const { put, saved } = setup({ paymentType: 'monthly' });
    await put();
    expect(saved[0]).toMatchObject({ amount: 0, status: PaymentStatus.WAIVED, source: 'dues' });
  });

  it('already on it: nothing changes', async () => {
    const { put, saved } = setup({ onGame: true });
    expect(await put()).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('groups that take replies: they say "I\'m in" themselves', async () => {
    const { put, saved } = setup({ requireRsvp: true });
    expect(await put()).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it("not a game of this group's that's still on: nothing", async () => {
    expect(await setup({ game: null }).put()).toBe(false);
    const past = setup({ game: { id: 's1', groupId: 'g1', kind: SessionKind.GAME, status: SessionStatus.UPCOMING, date: '2020-01-01' } });
    expect(await past.put()).toBe(false);
    expect(past.saved).toHaveLength(0);
  });
});
