import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The vote now opens when the organiser ends the game (not at midnight on match day) and stays
 * open for 48 hours. Games ended before this keep the old window, so votes already open aren't
 * cut short; only games ended from now on get a time here.
 */
export class VoteOpensAtFullTime1793000000000 implements MigrationInterface {
  name = 'VoteOpensAtFullTime1793000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "vote_opens_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "vote_opens_at"`);
  }
}
