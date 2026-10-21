import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vice-captains: one more player per side who can keep the score on match day, like the captain. */
export class ViceCaptains1795300000000 implements MigrationInterface {
  name = 'ViceCaptains1795300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "vice_captain" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "vice_captain"`);
  }
}
