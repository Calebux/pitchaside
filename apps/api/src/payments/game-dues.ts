import { EntityManager, In } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Group } from '../groups/entities/group.entity';
import { Session, SessionKind } from '../sessions/entities/session.entity';
import { isPeriodic, periodOfGame } from '../billing/periods';

/**
 * `source` of a game's squad entry in a group that collects dues per period: the player is
 * playing, but the game costs nothing extra — their period's dues cover it.
 */
export const COVERED_BY_DUES = 'dues';

export function coveredByDues(p: Pick<Payment, 'source'>) {
  return p.source === COVERED_BY_DUES;
}

/**
 * A player's entry in a game: a due for the fee in pay-per-game groups, or a ₦0 entry covered
 * by their dues in groups that collect monthly, weekly, quarterly or yearly.
 */
export function squadEntry(group: Pick<Group, 'paymentType' | 'feePerPlayer'>, sessionId: string, playerId: string): Partial<Payment> {
  return isPeriodic(group.paymentType)
    ? { sessionId, playerId, amount: 0, status: PaymentStatus.WAIVED, source: COVERED_BY_DUES }
    : { sessionId, playerId, amount: Number(group.feePerPlayer) };
}

/** What a game is expected to bring in: nothing extra when dues cover it. */
export function gameTarget(group: Pick<Group, 'paymentType' | 'feePerPlayer' | 'targetPlayers'>) {
  return isPeriodic(group.paymentType) ? 0 : group.targetPlayers * Number(group.feePerPlayer);
}

export type GamePaid = 'paid' | 'unpaid' | 'waived';

function fromStatus(status: PaymentStatus | undefined): GamePaid {
  return status === PaymentStatus.PAID ? 'paid' : status === PaymentStatus.WAIVED ? 'waived' : 'unpaid';
}

/**
 * Whether each player in each game has paid for it: their due for the game, or — when dues
 * cover the game — their dues for the period the game falls in.
 * Games need `group` and `payments` loaded. Returns sessionId → playerId → status.
 */
export async function paidForGames(
  manager: EntityManager,
  games: (Pick<Session, 'id' | 'date' | 'groupId' | 'payments'> & { group: Pick<Group, 'paymentType'> })[],
) {
  const periodKey = (g: (typeof games)[number]) => `${g.groupId}|${periodOfGame(g.group.paymentType, g.date).start}`;
  const covered = games.filter((g) => isPeriodic(g.group.paymentType));

  // Each period's dues, fetched once for all the games that fall in it.
  const duesByPeriod = new Map<string, Map<string, PaymentStatus>>();
  if (covered.length) {
    const periods = await manager.find(Session, {
      where: {
        kind: SessionKind.DUES,
        groupId: In([...new Set(covered.map((g) => g.groupId))]),
        date: In([...new Set(covered.map((g) => periodOfGame(g.group.paymentType, g.date).start))]),
      },
      relations: ['payments'],
    });
    for (const p of periods) {
      duesByPeriod.set(`${p.groupId}|${String(p.date).slice(0, 10)}`, new Map((p.payments ?? []).map((d) => [d.playerId, d.status])));
    }
  }

  const result = new Map<string, Map<string, GamePaid>>();
  for (const g of games) {
    const dues = isPeriodic(g.group.paymentType) ? duesByPeriod.get(periodKey(g)) : undefined;
    result.set(
      g.id,
      new Map(
        (g.payments ?? []).map((p) => [
          p.playerId,
          isPeriodic(g.group.paymentType) ? fromStatus(dues?.get(p.playerId)) : fromStatus(p.status),
        ]),
      ),
    );
  }
  return result;
}
