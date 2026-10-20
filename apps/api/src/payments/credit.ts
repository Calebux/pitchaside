import { EntityManager } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';

/** Paid from the member's bank transfers, so the money is sitting in the group's account. */
export function paidByTransfer(p: Payment) {
  return p.status === PaymentStatus.PAID && p.source === 'transfer';
}

/**
 * Dues paid from transfers that no longer stand (game deleted or cancelled, due waived): their
 * amounts go back to each member's credit in `groupId`, where they pay the member's next due.
 * Dues marked paid by hand give back only what came from transfers (`fromCredit`): the rest never
 * reached the group's account.
 * Returns the members credited.
 */
export async function refundToCredit(manager: EntityManager, groupId: string, payments: Payment[]): Promise<string[]> {
  const byPlayer = new Map<string, number>();
  for (const p of payments) {
    // By transfer: all of it. Marked paid by hand: only the part that came from their transfers.
    const back = paidByTransfer(p) ? Number(p.amount) : p.status === PaymentStatus.PAID ? Number(p.fromCredit ?? 0) : 0;
    if (back > 0) byPlayer.set(p.playerId, (byPlayer.get(p.playerId) ?? 0) + back);
    // Given back: the caller saves the payment with nothing left from transfers on it.
    if (!paidByTransfer(p) && back > 0) p.fromCredit = '0';
  }
  if (!byPlayer.size) return [];

  return manager.transaction(async (tx) => {
    const credited: string[] = [];
    for (const [playerId, amount] of byPlayer) {
      const membership = await tx.findOne(GroupMembership, {
        where: { groupId, playerId },
        lock: { mode: 'pessimistic_write' },
      });
      // No longer a member: the money is still on the transfer, for an admin to sort out.
      if (!membership) continue;
      membership.credit = (Number(membership.credit) + amount).toFixed(2);
      await tx.save(membership);
      credited.push(playerId);
    }
    return credited;
  });
}

/**
 * The dues money can pay now, from a member's unpaid dues in date order: games already played
 * (or today's), and their one next game. Never games further ahead: a transfer is for this
 * week's game, and more than that is the organiser's to sort (someone else's, kept, or sent back).
 */
export function payableNow<T extends { session: { date: string | Date } }>(pending: T[], today: string): T[] {
  let next = false;
  return pending.filter((p) => {
    const d = p.session.date instanceof Date ? p.session.date.toISOString().slice(0, 10) : String(p.session.date).slice(0, 10);
    if (d <= today) return true;
    if (next) return false;
    next = true;
    return true;
  });
}
