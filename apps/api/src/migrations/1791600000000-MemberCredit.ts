import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial payments: a member's credit (paid but not yet enough for a due) and who
 * each bank transfer came from, even when it didn't pay a due.
 */
export class MemberCredit1791600000000 implements MigrationInterface {
  name = 'MemberCredit1791600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "credit" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "player_id" uuid`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE "bank_transfers" ADD CONSTRAINT "FK_bank_transfers_player"
        FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    // Transfers already matched to a payment came from that payment's player.
    await q.query(`UPDATE "bank_transfers" t SET "player_id" = p."player_id" FROM "payments" p WHERE t."payment_id" = p.id AND t."player_id" IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "bank_transfers" DROP CONSTRAINT IF EXISTS "FK_bank_transfers_player"`);
    await q.query(`ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "player_id"`);
    await q.query(`ALTER TABLE "group_memberships" DROP COLUMN IF EXISTS "credit"`);
  }
}
