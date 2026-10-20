import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The match-day timer: how long a group's games usually last, and for each day its own length
 * (when changed at the pitch) and when the running game's clock was started.
 */
export class GameTimer1794800000000 implements MigrationInterface {
  name = 'GameTimer1794800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "game_minutes" int`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "timer_minutes" int`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "timer_started_at" timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "timer_started_at"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "timer_minutes"`);
    await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "game_minutes"`);
  }
}
