import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Money that isn't a player's: incoming transfers can be marked as the organiser's own top-up, a
 * sponsor, a refund or other (a new status that still counts in the balance), with a note; and
 * withdrawals get what they were for (pitch, footballs, bibs, water, supplies, refund, other).
 */
export class MoneyCategories1793900000000 implements MigrationInterface {
  name = 'MoneyCategories1793900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE "public"."bank_transfers_status_enum" ADD VALUE IF NOT EXISTS 'other'`);
    await q.query(`ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "category" varchar(20)`);
    await q.query(`ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "note" varchar(200)`);
    await q.query(`ALTER TABLE "outgoing_transfers" ADD COLUMN IF NOT EXISTS "category" varchar(20)`);
    // Refunds to a player were already marked by who they refunded.
    await q.query(`UPDATE "outgoing_transfers" SET "category" = 'refund' WHERE "refund_player_id" IS NOT NULL AND "category" IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "bank_transfers" SET "status" = 'unmatched' WHERE "status" = 'other'`);
    await q.query(`ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "category"`);
    await q.query(`ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "note"`);
    await q.query(`ALTER TABLE "outgoing_transfers" DROP COLUMN IF EXISTS "category"`);
  }
}
