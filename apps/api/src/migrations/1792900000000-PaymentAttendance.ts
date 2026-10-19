import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether a player turned up to a game: null (not recorded; counts as came), 'came' or
 * 'no_show'. Existing games keep null, so nothing anyone owes changes on deploy; organisers mark
 * no-shows from now on. Two audit actions record those changes.
 */
export class PaymentAttendance1792900000000 implements MigrationInterface {
  name = 'PaymentAttendance1792900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "attendance" character varying`);
    await q.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'payment_no_show'`);
    await q.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'payment_came'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "attendance"`);
    // Postgres can't remove enum values; they're harmless if left.
  }
}
