import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Custom bibs: each side's colour and an optional name. Set once for a group (used every week)
 * and, for one game, changed on match day. Null means the defaults (Orange, Yellow, Blue…).
 */
export class Bibs1794700000000 implements MigrationInterface {
  name = 'Bibs1794700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "bibs" jsonb`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "bibs" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "bibs"`);
    await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "bibs"`);
  }
}
