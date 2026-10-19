import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The vote closes early once everyone who came has voted, so the result doesn't wait out the
 * 48 hours for nothing. Null means it runs its full time.
 */
export class VoteClosedEarly1793100000000 implements MigrationInterface {
  name = 'VoteClosedEarly1793100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "vote_closed_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "vote_closed_at"`);
  }
}
