import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The match day plan: how the organiser set up the day (booked time, game length, players on
 * the pitch, how often to swap, who left early), and whether each player is happy to go in goal.
 */
export class MatchDayPlan1795500000000 implements MigrationInterface {
  name = 'MatchDayPlan1795500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "plan" jsonb`);
    await q.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "keeper" varchar(12)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "keeper"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "plan"`);
  }
}
