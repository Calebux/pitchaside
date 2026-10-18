import { MigrationInterface, QueryRunner } from 'typeorm';
import { whoSent, type MemberLike } from '../billing/payer-name';
import { claimSettledBy } from '../billing/claims';

/**
 * Applies the newer matching rules to money that came in before them, once, on deploy:
 *
 * 1. Unmatched transfers whose sender we can now name for certain (the player's code, an account
 *    that has only ever paid for one player, or a "Transfer from NAME" narration that fits exactly
 *    one member) go to that player the same way a
 *    live one does: they pay the player's oldest unpaid games while the money covers a whole one,
 *    and the rest is kept for their next game. Game totals are recounted.
 * 2. "I've paid" taps that were already answered by a matched transfer are closed, so they stop
 *    showing as suggestions under other transfers.
 *
 * No receipts or notifications go out for these: the money arrived days or weeks ago. Transfers
 * that still can't be named are left for the organiser. Not reversible (down is a no-op): undoing
 * it would mean un-paying games people have since seen as paid.
 */
export class PlacePastTransfers1792800000000 implements MigrationInterface {
  name = 'PlacePastTransfers1792800000000';

  public async up(q: QueryRunner): Promise<void> {
    const unmatched: {
      id: string;
      group_id: string;
      amount: string;
      sender_name: string | null;
      sender_account: string | null;
      narration: string | null;
    }[] = await q.query(
      `SELECT id, group_id, amount, sender_name, sender_account, narration FROM bank_transfers
       WHERE status = 'unmatched' AND group_id IS NOT NULL ORDER BY received_at`,
    );
    // Who each account has paid for so far, per group; grows as this migration places transfers.
    const paidFor = new Map<string, Set<string>>();
    const accountKey = (groupId: string, account: string) => `${groupId}:${account}`;
    const known: { group_id: string; sender_account: string; player_id: string }[] = await q.query(
      `SELECT DISTINCT group_id, sender_account, player_id FROM bank_transfers
       WHERE sender_account IS NOT NULL AND player_id IS NOT NULL AND status IN ('matched', 'assigned')`,
    );
    for (const k of known) {
      const key = accountKey(k.group_id, k.sender_account);
      paidFor.set(key, (paidFor.get(key) ?? new Set()).add(k.player_id));
    }
    const squads = new Map<string, MemberLike[]>();
    const touchedSessions = new Set<string>();
    let placed = 0;
    let gamesPaid = 0;

    for (const t of unmatched) {
      if (!squads.has(t.group_id)) {
        const rows: { player_id: string; payment_ref: string | null; firstName: string; lastName: string }[] = await q.query(
          `SELECT m.player_id, m.payment_ref, p."firstName", p."lastName"
           FROM group_memberships m JOIN players p ON p.id = m.player_id WHERE m.group_id = $1`,
          [t.group_id],
        );
        squads.set(
          t.group_id,
          rows.map((r) => ({ playerId: r.player_id, paymentRef: r.payment_ref, firstName: r.firstName, lastName: r.lastName })),
        );
      }
      const payers = t.sender_account ? paidFor.get(accountKey(t.group_id, t.sender_account)) : undefined;
      const accountOwner = payers?.size === 1 ? [...payers][0] : null;
      const playerId = whoSent(squads.get(t.group_id)!, t.sender_name, t.narration, accountOwner);
      if (!playerId) continue;

      const [, claimed] = await q.query(
        `UPDATE bank_transfers SET status = 'matched', player_id = $2 WHERE id = $1 AND status = 'unmatched'`,
        [t.id, playerId],
      );
      if (!claimed) continue;
      placed++;
      if (t.sender_account) {
        const key = accountKey(t.group_id, t.sender_account);
        paidFor.set(key, (paidFor.get(key) ?? new Set()).add(playerId));
      }

      // Same as BillingService.applyCredit: credit + this transfer pays the oldest whole dues.
      const [membership] = await q.query(
        `SELECT credit FROM group_memberships WHERE group_id = $1 AND player_id = $2 FOR UPDATE`,
        [t.group_id, playerId],
      );
      let pool = Number(membership.credit) + Number(t.amount);
      const pending: { id: string; amount: string; session_id: string }[] = await q.query(
        `SELECT p.id, p.amount, p.session_id FROM payments p JOIN sessions s ON s.id = p.session_id
         WHERE s.group_id = $1 AND p.player_id = $2 AND p.status = 'pending' AND s.status != 'cancelled'
         ORDER BY s.date ASC`,
        [t.group_id, playerId],
      );
      const settled: string[] = [];
      for (const p of pending) {
        if (pool + 0.001 < Number(p.amount)) break;
        pool -= Number(p.amount);
        settled.push(p.id);
        touchedSessions.add(p.session_id);
      }
      if (settled.length) {
        await q.query(
          `UPDATE payments SET status = 'paid', "paidAt" = now(), source = 'transfer', "markedBy" = 'pulse' WHERE id = ANY($1)`,
          [settled],
        );
        await q.query(`UPDATE bank_transfers SET payment_id = $2 WHERE id = $1`, [t.id, settled[0]]);
        gamesPaid += settled.length;
      }
      await q.query(`UPDATE group_memberships SET credit = $3 WHERE group_id = $1 AND player_id = $2`, [
        t.group_id,
        playerId,
        pool.toFixed(2),
      ]);
    }

    if (touchedSessions.size) {
      await q.query(
        `UPDATE sessions s SET "collectedAmount" = (
           SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.session_id = s.id AND p.status = 'paid'
         ) WHERE s.id = ANY($1)`,
        [[...touchedSessions]],
      );
    }

    // "I've paid" taps answered by a transfer that's already the player's.
    const claims: { id: string; group_id: string; player_id: string; amount: string; created_at: Date }[] = await q.query(
      `SELECT id, group_id, player_id, amount, created_at FROM payment_claims WHERE status = 'pending' ORDER BY created_at`,
    );
    let closed = 0;
    const byPlayer = new Map<string, typeof claims>();
    for (const c of claims) {
      const key = `${c.group_id}:${c.player_id}`;
      byPlayer.set(key, [...(byPlayer.get(key) ?? []), c]);
    }
    for (const [key, open] of byPlayer) {
      const [groupId, playerId] = key.split(':');
      const theirs: { id: string; amount: string; received_at: Date }[] = await q.query(
        `SELECT t.id, t.amount, t.received_at FROM bank_transfers t
         WHERE t.group_id = $1 AND t.player_id = $2 AND t.status IN ('matched', 'assigned')
           AND NOT EXISTS (SELECT 1 FROM payment_claims c WHERE c.transfer_id = t.id)
         ORDER BY t.received_at`,
        [groupId, playerId],
      );
      let left = open.map((c) => ({ id: c.id, playerId, amount: c.amount, createdAt: c.created_at }));
      for (const t of theirs) {
        const claim = claimSettledBy({ id: t.id, amount: t.amount, receivedAt: t.received_at }, playerId, left);
        if (!claim) continue;
        await q.query(`UPDATE payment_claims SET status = 'matched', transfer_id = $2 WHERE id = $1`, [claim.id, t.id]);
        left = left.filter((c) => c.id !== claim.id);
        closed++;
      }
    }

    console.log(
      `[migrations] PlacePastTransfers: ${placed} of ${unmatched.length} unmatched transfers placed (${gamesPaid} games paid), ${closed} answered "I've paid" taps closed`,
    );
  }

  public async down(): Promise<void> {
    // Not reversible: see above.
  }
}
