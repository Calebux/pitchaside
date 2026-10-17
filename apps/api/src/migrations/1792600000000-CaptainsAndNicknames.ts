import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Captains: one player per side on match day can be its captain; the side then goes by their name.
 * - Nicknames: what a player is called on the pitch, shown on team sheets.
 */
export class CaptainsAndNicknames1792600000000 implements MigrationInterface {
  name = 'CaptainsAndNicknames1792600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "captain" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "nickname" character varying(24)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "nickname"`);
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "captain"`);
  }
}
