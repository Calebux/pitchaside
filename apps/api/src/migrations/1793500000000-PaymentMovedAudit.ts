import { MigrationInterface, QueryRunner } from 'typeorm';

/** The audit log records when an organiser moves a payment to another game. */
export class PaymentMovedAudit1793500000000 implements MigrationInterface {
  name = 'PaymentMovedAudit1793500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'payment_moved'`);
  }

  public async down(): Promise<void> {
    // Postgres can't drop a value from an enum; the extra value is harmless if left.
  }
}
