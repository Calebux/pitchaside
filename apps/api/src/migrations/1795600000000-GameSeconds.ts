import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How long each match-day game lasted, from the timer: winner stays games end at a goal or a time
 * limit, and the app shares minutes out fairly from what was really played.
 */
export class GameSeconds1795600000000 implements MigrationInterface {
  name = 'GameSeconds1795600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "session_games" ADD COLUMN IF NOT EXISTS "seconds" int`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "session_games" DROP COLUMN IF EXISTS "seconds"`);
  }
}
