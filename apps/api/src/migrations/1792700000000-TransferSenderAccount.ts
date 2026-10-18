import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keeps the account each bank transfer came from (its last 10 digits), so an account that has paid
 * for one player is recognised next time without a name. Fills it in for transfers already on
 * record from the bank's own message, which we've always stored in `raw`.
 */
export class TransferSenderAccount1792700000000 implements MigrationInterface {
  name = 'TransferSenderAccount1792700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "sender_account" character varying`);
    // The same fields the webhook parser reads (debit_account / sender_account / senderAccount), with or without a "data" wrapper.
    await q.query(`
      UPDATE "bank_transfers" SET "sender_account" = RIGHT(acct, 10)
      FROM (
        SELECT id, regexp_replace(COALESCE(
          raw->'data'->>'debit_account', raw->'data'->>'sender_account', raw->'data'->>'senderAccount',
          raw->>'debit_account', raw->>'sender_account', raw->>'senderAccount', ''), '\\D', '', 'g') AS acct
        FROM "bank_transfers" WHERE "sender_account" IS NULL AND raw IS NOT NULL
      ) src
      WHERE src.id = "bank_transfers".id AND length(src.acct) >= 10`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bank_transfers_sender_account" ON "bank_transfers" ("sender_account")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_bank_transfers_sender_account"`);
    await q.query(`ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "sender_account"`);
  }
}
