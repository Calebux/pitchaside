import { PaymentType } from '../groups/entities/group.entity';
import { SessionKind } from '../sessions/entities/session.entity';
import { PaymentStatus } from './entities/payment.entity';
import { COVERED_BY_DUES, gameTarget, paidForGames, squadEntry } from './game-dues';

const perGame = { paymentType: PaymentType.PER_SESSION, feePerPlayer: 1500, targetPlayers: 10 } as any;
const monthly = { paymentType: PaymentType.MONTHLY, feePerPlayer: 10000, targetPlayers: 10 } as any;

describe('squadEntry', () => {
  it('charges the fee in pay-per-game groups', () => {
    expect(squadEntry(perGame, 's1', 'p1')).toEqual({ sessionId: 's1', playerId: 'p1', amount: 1500 });
    expect(gameTarget(perGame)).toBe(15000);
  });

  it("charges nothing for a game when the month's dues cover it", () => {
    expect(squadEntry(monthly, 's1', 'p1')).toMatchObject({ amount: 0, status: PaymentStatus.WAIVED, source: COVERED_BY_DUES });
    expect(gameTarget(monthly)).toBe(0);
  });
});

describe('paidForGames', () => {
  it("reads a per-game group's own dues", async () => {
    const manager = { find: jest.fn() } as any;
    const game = {
      id: 'g1', date: '2026-10-06', groupId: 'grp', group: perGame,
      payments: [
        { playerId: 'a', status: PaymentStatus.PAID },
        { playerId: 'b', status: PaymentStatus.PENDING },
      ],
    } as any;

    const paid = (await paidForGames(manager, [game])).get('g1')!;

    expect(Object.fromEntries(paid)).toEqual({ a: 'paid', b: 'unpaid' });
    expect(manager.find).not.toHaveBeenCalled();
  });

  it("reads a monthly group's dues for the month the game is in", async () => {
    const manager = {
      find: jest.fn(async (_entity: unknown, opts: any) => {
        expect(opts.where.kind).toBe(SessionKind.DUES);
        return [
          {
            groupId: 'grp', date: '2026-10-01',
            payments: [
              { playerId: 'a', status: PaymentStatus.PAID },
              { playerId: 'b', status: PaymentStatus.PENDING },
            ],
          },
        ];
      }),
    } as any;
    const covered = (playerId: string) => ({ playerId, status: PaymentStatus.WAIVED, source: COVERED_BY_DUES });
    const game = { id: 'g1', date: '2026-10-06', groupId: 'grp', group: monthly, payments: [covered('a'), covered('b'), covered('c')] } as any;

    const paid = (await paidForGames(manager, [game])).get('g1')!;

    // c joined after the month's dues were raised: nothing paid yet.
    expect(Object.fromEntries(paid)).toEqual({ a: 'paid', b: 'unpaid', c: 'unpaid' });
  });
});
