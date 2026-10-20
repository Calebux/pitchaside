import { MigrationInterface, QueryRunner } from 'typeorm';
import { localDate } from '../common/time.util';

/**
 * Money a member sent beyond what they owed used to be kept as "paid ahead" and spent on their
 * next games by itself, so players looked paid for games they hadn't paid for. Usually it was
 * for a friend or a wrong amount. From now on it waits as `extra` until the organiser sorts it.
 *
 * For what's already happened (as agreed with the organiser):
 * 1. Games not played yet that were paid wholly from earlier money ('credit') go back to
 *    unpaid, and the money goes back to the member. Played games stay paid.
 * 2. Money kept for a member becomes extra to sort, unless it's a part payment towards a game
 *    they owe (less than that game's fee), which stays where it is.
 */
export class ExtraToSort1794000000000 implements MigrationInterface {
  name = 'ExtraToSort1794000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "extra" numeric(12,2) NOT NULL DEFAULT 0`);

    const today = localDate();

    // 1. Upcoming games paid from earlier money: back to unpaid, the money back to the member.
    const undo: { id: string; player_id: string; group_id: string; session_id: string; amount: string }[] = await q.query(
      `SELECT p.id, p.player_id, s.group_id, p.session_id, p.amount
         FROM payments p JOIN sessions s ON s.id = p.session_id
        WHERE p.status = 'paid' AND p.source = 'transfer' AND p."markedBy" = 'credit'
          AND s.status <> 'cancelled' AND s.date > $1
        FOR UPDATE OF p`,
      [today],
    );
    for (const p of undo) {
      await q.query(`UPDATE payments SET status = 'pending', "paidAt" = NULL, source = NULL, "markedBy" = NULL WHERE id = $1`, [p.id]);
      await q.query(`UPDATE group_memberships SET credit = credit + $1 WHERE group_id = $2 AND player_id = $3`, [p.amount, p.group_id, p.player_id]);
    }
    const sessions = [...new Set(undo.map((p) => p.session_id))];
    if (sessions.length) {
      await q.query(
        `UPDATE sessions SET "collectedAmount" = COALESCE((SELECT SUM(amount) FROM payments WHERE session_id = sessions.id AND status = 'paid'), 0)
          WHERE id = ANY($1)`,
        [sessions],
      );
    }

    // 2. Kept money becomes extra to sort, except a part payment towards a game they owe.
    const kept: { id: string; group_id: string; player_id: string; credit: string }[] = await q.query(
      `SELECT id, group_id, player_id, credit FROM group_memberships WHERE credit > 0 FOR UPDATE`,
    );
    let moved = 0;
    let movedTotal = 0;
    let partKept = 0;
    for (const m of kept) {
      const [due] = await q.query(
        `SELECT p.amount FROM payments p JOIN sessions s ON s.id = p.session_id
          WHERE s.group_id = $1 AND p.player_id = $2 AND p.status = 'pending' AND s.status <> 'cancelled' AND p.amount > 0
          ORDER BY s.date ASC LIMIT 1`,
        [m.group_id, m.player_id],
      );
      if (due && Number(m.credit) + 0.001 < Number(due.amount)) {
        partKept++;
        continue;
      }
      await q.query(`UPDATE group_memberships SET extra = extra + credit, credit = 0 WHERE id = $1`, [m.id]);
      moved++;
      movedTotal += Number(m.credit);
    }

    console.log(
      `ExtraToSort: ${undo.length} upcoming game payment(s) made from earlier money set back to unpaid; ` +
        `₦${movedTotal.toFixed(2)} kept money of ${moved} member(s) moved to extra to sort; ${partKept} part payment(s) left as they are`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // The games set back to unpaid aren't paid again: money goes back to kept, as before.
    await q.query(`UPDATE group_memberships SET credit = credit + extra, extra = 0 WHERE extra > 0`);
    await q.query(`ALTER TABLE "group_memberships" DROP COLUMN IF EXISTS "extra"`);
  }
}
