import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Incoming transfers used to be saved with a bank "fee" added back on top of what the bank
 * reported (₦1,500 sent → ₦1,525 saved), and the extra went to the payer's "kept for next game".
 * This puts every bank-reported transfer back to the amount the bank reported (kept in `raw`),
 * and takes the extra back off each payer's kept money, never below ₦0. Extra that was already
 * spent on a game can't be taken back here; it's logged per player so it can be checked by hand.
 * Transfers recorded by hand (`raw.manual`) never had anything added and are left alone.
 */
export class NoFeeAddBack1793300000000 implements MigrationInterface {
  name = 'NoFeeAddBack1793300000000';

  public async up(q: QueryRunner): Promise<void> {
    const reported = `COALESCE(("raw"->'data'->>'amount')::numeric, ("raw"->>'amount')::numeric)`;
    // Only rows whose saved amount is the reported amount plus an add-back (₦2 to ₦25).
    const fixable = `"raw" IS NOT NULL AND COALESCE("raw"->>'manual', '') <> 'true' AND ${reported} IS NOT NULL
      AND "amount" - ${reported} > 0 AND "amount" - ${reported} <= 25`;

    // Per player and group: how much extra their placed transfers gave them.
    const extras: { group_id: string; player_id: string; extra: string }[] = await q.query(
      `SELECT "group_id", "player_id", SUM("amount" - ${reported}) AS extra
         FROM "bank_transfers"
        WHERE ${fixable} AND "player_id" IS NOT NULL AND "group_id" IS NOT NULL AND "status" IN ('matched', 'assigned')
        GROUP BY "group_id", "player_id"`,
    );

    const fixed: { count: string }[] = await q.query(
      `WITH changed AS (UPDATE "bank_transfers" SET "amount" = ${reported} WHERE ${fixable} RETURNING 1) SELECT COUNT(*) AS count FROM changed`,
    );

    let takenBack = 0;
    const spent: string[] = [];
    for (const { group_id, player_id, extra } of extras) {
      const rows: { credit: string }[] = await q.query(
        `SELECT "credit" FROM "group_memberships" WHERE "group_id" = $1 AND "player_id" = $2 FOR UPDATE`,
        [group_id, player_id],
      );
      if (!rows.length) continue;
      await q.query(`UPDATE "group_memberships" SET "credit" = GREATEST(0, "credit" - $3) WHERE "group_id" = $1 AND "player_id" = $2`, [
        group_id,
        player_id,
        extra,
      ]);
      const before = Number(rows[0].credit);
      const owed = Number(extra);
      takenBack += Math.min(before, owed);
      if (owed > before) spent.push(`group ${group_id} player ${player_id}: ₦${(owed - before).toFixed(2)} of the extra was already spent`);
    }

    console.log(
      `NoFeeAddBack: ${fixed[0]?.count ?? 0} transfers set back to the bank's amount; ₦${takenBack.toFixed(2)} taken back off kept money` +
        (spent.length ? `; already spent, check by hand:\n  ${spent.join('\n  ')}` : '; nothing already spent'),
    );
  }

  public async down(): Promise<void> {
    // Adding a fee that was never paid back on is what this fixes; there's nothing to undo to.
  }
}
