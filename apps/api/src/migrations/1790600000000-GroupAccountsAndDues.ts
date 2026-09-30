import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Group collection accounts (PulseMFB), shareable group links, billing
 * frequencies (weekly → annually), dues periods and bank transfer records.
 *
 * Written to be idempotent because earlier schema changes were applied via
 * `synchronize` rather than migrations.
 */
export class GroupAccountsAndDues1790600000000 implements MigrationInterface {
  name = 'GroupAccountsAndDues1790600000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const v of ['weekly', 'quarterly', 'annually']) {
      await q.query(`ALTER TYPE "public"."groups_paymenttype_enum" ADD VALUE IF NOT EXISTS '${v}'`);
    }

    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "invite_code" character varying`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "account_number" character varying`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "account_name" character varying`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "bank_name" character varying`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "account_reference" character varying`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_groups_invite_code" ON "groups" ("invite_code")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_groups_account_number" ON "groups" ("account_number")`);

    await q.query(`ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "payment_ref" character varying`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_group_memberships_payment_ref" ON "group_memberships" ("payment_ref")`);

    await q.query(`DO $$ BEGIN
      CREATE TYPE "public"."sessions_kind_enum" AS ENUM('game', 'dues');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "kind" "public"."sessions_kind_enum" NOT NULL DEFAULT 'game'`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "label" character varying`);

    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "source" character varying`);

    await q.query(`DO $$ BEGIN
      CREATE TYPE "public"."bank_transfers_status_enum" AS ENUM('matched', 'assigned', 'unmatched', 'ignored');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "bank_transfers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "provider_transaction_id" character varying NOT NULL,
      "group_id" uuid,
      "account_number" character varying NOT NULL,
      "amount" numeric(12,2) NOT NULL,
      "sender_name" character varying,
      "narration" character varying,
      "status" "public"."bank_transfers_status_enum" NOT NULL DEFAULT 'unmatched',
      "payment_id" uuid,
      "received_at" TIMESTAMP NOT NULL,
      "raw" jsonb,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_bank_transfers_provider_txn" UNIQUE ("provider_transaction_id"),
      CONSTRAINT "PK_bank_transfers" PRIMARY KEY ("id"),
      CONSTRAINT "FK_bank_transfers_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_bank_transfers_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "bank_transfers"`);
    await q.query(`DROP TYPE IF EXISTS "public"."bank_transfers_status_enum"`);
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "source"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "label"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "kind"`);
    await q.query(`DROP TYPE IF EXISTS "public"."sessions_kind_enum"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_group_memberships_payment_ref"`);
    await q.query(`ALTER TABLE "group_memberships" DROP COLUMN IF EXISTS "payment_ref"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_groups_account_number"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_groups_invite_code"`);
    for (const c of ['account_reference', 'bank_name', 'account_name', 'account_number', 'invite_code']) {
      await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "${c}"`);
    }
    // Postgres can't drop enum values; weekly/quarterly/annually stay on groups_paymenttype_enum.
  }
}
