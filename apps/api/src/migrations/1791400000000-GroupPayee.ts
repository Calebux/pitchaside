import { MigrationInterface, QueryRunner } from 'typeorm';

/** Each group can save who it pays out to (pitch owner / facility manager) and the usual amount. */
export class GroupPayee1791400000000 implements MigrationInterface {
  name = 'GroupPayee1791400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "payee_label" character varying(40)`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "payee_name" character varying`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "payee_account" character varying(10)`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "payee_bank_code" character varying(10)`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "payee_bank_name" character varying`);
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "payee_amount" numeric(12,2)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const col of ['payee_amount', 'payee_bank_name', 'payee_bank_code', 'payee_account', 'payee_name', 'payee_label']) {
      await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
