import { EntityManager } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Session, SessionStatus } from '../sessions/entities/session.entity';

/**
 * Part payments. Money a player sends that doesn't cover a whole due waits in their kept money
 * (`membership.credit`) and pays their oldest unpaid due in the group once it covers it. Until then,
 * that oldest due is part paid: this says by how much, so every screen and reminder can say
 * "₦1,000 paid · ₦500 left" instead of "₦1,500 to pay".
 */

/** Each player's oldest unpaid due per group, in the order kept money pays them. */
async function oldestDues(manager: EntityManager, groupIds: string[], playerIds: string[]) {
  if (!groupIds.length || !playerIds.length) return new Map<string, string>();
  const rows: { id: string; group_id: string; player_id: string }[] = await manager
    .getRepository(Payment)
    .createQueryBuilder('payment')
    .innerJoin('payment.session', 'session')
    .select('DISTINCT ON (session.group_id, payment.player_id) payment.id', 'id')
    .addSelect('session.group_id', 'group_id')
    .addSelect('payment.player_id', 'player_id')
    .where('session.group_id IN (:...groupIds)', { groupIds })
    .andWhere('payment.player_id IN (:...playerIds)', { playerIds })
    .andWhere('payment.status = :pending', { pending: PaymentStatus.PENDING })
    .andWhere('session.status != :cancelled', { cancelled: SessionStatus.CANCELLED })
    .andWhere('payment.amount > 0')
    .orderBy('session.group_id')
    .addOrderBy('payment.player_id')
    .addOrderBy('session.date', 'ASC')
    .addOrderBy('session.createdAt', 'ASC')
    .getRawMany();
  return new Map(rows.map((r) => [`${r.group_id}:${r.player_id}`, r.id]));
}

/** Payment id → how much is already paid towards it, for the unpaid ones among `items`. */
export async function partPaidAmounts(
  manager: EntityManager,
  items: { id: string; playerId: string; groupId: string; amount: number | string; status: string }[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const open = items.filter((p) => p.status === PaymentStatus.PENDING && Number(p.amount) > 0);
  if (!open.length) return out;
  const groupIds = [...new Set(open.map((p) => p.groupId))];
  const playerIds = [...new Set(open.map((p) => p.playerId))];
  const kept = await manager
    .getRepository(GroupMembership)
    .createQueryBuilder('m')
    .where('m.groupId IN (:...groupIds)', { groupIds })
    .andWhere('m.playerId IN (:...playerIds)', { playerIds })
    .andWhere('m.credit > 0')
    .getMany();
  if (!kept.length) return out;
  const oldest = await oldestDues(manager, groupIds, [...new Set(kept.map((m) => m.playerId))]);
  const creditOf = new Map(kept.map((m) => [`${m.groupId}:${m.playerId}`, Number(m.credit)]));
  for (const p of open) {
    const key = `${p.groupId}:${p.playerId}`;
    const credit = creditOf.get(key) ?? 0;
    if (credit > 0 && oldest.get(key) === p.id) out.set(p.id, Math.min(credit, Number(p.amount)));
  }
  return out;
}

/** Sets `paidSoFar` on the part-paid payments of these sessions. */
export async function markPartPaid(manager: EntityManager, sessions: Session[]) {
  const items = sessions.flatMap((s) => (s.payments ?? []).map((p) => ({ id: p.id, playerId: p.playerId, groupId: s.groupId, amount: p.amount, status: p.status })));
  const paid = await partPaidAmounts(manager, items);
  for (const s of sessions) for (const p of s.payments ?? []) if (paid.has(p.id)) p.paidSoFar = paid.get(p.id);
  return sessions;
}

/**
 * The organiser marks a part-paid due paid (the rest came in cash): what the player had already
 * sent towards it comes out of their kept money, and is noted on the payment so undoing it gives
 * it back. Run inside the transaction that marks it paid. Returns the amount used.
 */
export async function usePartPaid(tx: EntityManager, payment: Payment, groupId: string): Promise<number> {
  const membership = await tx.findOne(GroupMembership, { where: { groupId, playerId: payment.playerId }, lock: { mode: 'pessimistic_write' } });
  const credit = Number(membership?.credit ?? 0);
  if (!membership || !(credit > 0)) return 0;
  const oldest = await oldestDues(tx, [groupId], [payment.playerId]);
  if (oldest.get(`${groupId}:${payment.playerId}`) !== payment.id) return 0;
  const used = Math.min(credit, Number(payment.amount));
  membership.credit = (credit - used).toFixed(2);
  await tx.save(membership);
  payment.fromCredit = used.toFixed(2);
  return used;
}
