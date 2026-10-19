import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Part payments: when a part-paid due is marked paid by hand, how much of it came from the money
 * the player had already sent by transfer, so undoing it gives that back.
 */
export class PartPaidFromCredit1793400000000 implements MigrationInterface {
  name = 'PartPaidFromCredit1793400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "from_credit" numeric(10,2) NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "from_credit"`);
  }
}
