import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-user crypto wallets.
 *
 * Creates the user_wallets table (one address per chain family per user) and
 * adds a nullable user_id column to crypto_transfers so incoming payments land
 * against the admin before being assigned to a group.
 */
export class UserWallets1795400000000 implements MigrationInterface {
  name = 'UserWallets1795400000000';

  public async up(q: QueryRunner): Promise<void> {
    // ── 1. user_wallets table ──
    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_wallets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "chain_family" varchar(10) NOT NULL,
        "address" varchar(64) NOT NULL,
        "derivation_index" int NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE("user_id", "chain_family")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_user_wallets_address" ON "user_wallets"("address")`);

    // ── 2. Add user_id to crypto_transfers ──
    await q.query(`ALTER TABLE "crypto_transfers" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "crypto_transfers" DROP COLUMN IF EXISTS "user_id"`);
    await q.query(`DROP TABLE IF EXISTS "user_wallets"`);
  }
}
