import { MigrationInterface, QueryRunner } from 'typeorm';

/** A payout can be a refund of a member's credit: who it refunds. */
export class PayoutRefunds1791800000000 implements MigrationInterface {
  name = 'PayoutRefunds1791800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "outgoing_transfers" ADD COLUMN IF NOT EXISTS "refund_player_id" uuid`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE "outgoing_transfers" ADD CONSTRAINT "FK_outgoing_transfers_refund_player"
        FOREIGN KEY ("refund_player_id") REFERENCES "players"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "outgoing_transfers" DROP CONSTRAINT IF EXISTS "FK_outgoing_transfers_refund_player"`);
    await q.query(`ALTER TABLE "outgoing_transfers" DROP COLUMN IF EXISTS "refund_player_id"`);
  }
}
