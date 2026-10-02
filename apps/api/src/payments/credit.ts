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
 * Dues marked paid by hand are left alone — that money never reached the group's account.
 * Returns the members credited.
 */
export async function refundToCredit(manager: EntityManager, groupId: string, payments: Payment[]): Promise<string[]> {
  const byPlayer = new Map<string, number>();
  for (const p of payments.filter(paidByTransfer)) {
    byPlayer.set(p.playerId, (byPlayer.get(p.playerId) ?? 0) + Number(p.amount));
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
