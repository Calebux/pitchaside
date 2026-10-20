import { EntityManager } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';

/** Paid from the member's bank transfers, so the money is sitting in the group's account. */
export function paidByTransfer(p: Payment) {
  return p.status === PaymentStatus.PAID && p.source === 'transfer';
}

/**
 * Dues paid from transfers that no longer stand (payment undone, taken off, didn't come, game
 * called off or deleted, due waived). What a transfer paid in full goes to the member's extra,
 * to sort: it never pays another game by itself. The organiser says what it was for (keep it
 * for their next game, someone else's, not in the group yet, or send it back).
 * A due marked paid by hand on top of a part payment gives back only that part (`fromCredit`),
 * and it goes back to what they've kept, a part payment again: the rest never reached the
 * group's account.
 * Returns the members given money back.
 */
export async function releaseToExtra(manager: EntityManager, groupId: string, payments: Payment[]): Promise<string[]> {
  const byPlayer = new Map<string, { extra: number; kept: number }>();
  for (const p of payments) {
    const whole = paidByTransfer(p) ? Number(p.amount) : 0;
    const part = !whole && p.status === PaymentStatus.PAID ? Number(p.fromCredit ?? 0) : 0;
    if (whole + part > 0) {
      const sum = byPlayer.get(p.playerId) ?? { extra: 0, kept: 0 };
      byPlayer.set(p.playerId, { extra: sum.extra + whole, kept: sum.kept + part });
    }
    // Given back: the caller saves the payment with nothing left from transfers on it.
    if (part > 0) p.fromCredit = '0';
  }
  if (!byPlayer.size) return [];

  return manager.transaction(async (tx) => {
    const given: string[] = [];
    for (const [playerId, { extra, kept }] of byPlayer) {
      const membership = await tx.findOne(GroupMembership, {
        where: { groupId, playerId },
        lock: { mode: 'pessimistic_write' },
      });
      // No longer a member: the money is still on the transfer, for an admin to sort out.
      if (!membership) continue;
      if (extra > 0) membership.extra = (Number(membership.extra ?? 0) + extra).toFixed(2);
      if (kept > 0) membership.credit = (Number(membership.credit) + kept).toFixed(2);
      await tx.save(membership);
      given.push(playerId);
    }
    return given;
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
