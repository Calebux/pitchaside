import { MigrationInterface, QueryRunner } from 'typeorm';

/** One match clock per game, shared by everyone in it. */
export class SharedMatchClock1792100000000 implements MigrationInterface {
  name = 'SharedMatchClock1792100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_minutes" integer NOT NULL DEFAULT 10`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_ends_at" timestamptz`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_left_ms" integer`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_teams" varchar(11)`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_user_id" uuid`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_updated_at" timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const c of ['clock_updated_at', 'clock_user_id', 'clock_teams', 'clock_left_ms', 'clock_ends_at', 'clock_minutes']) {
      await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
