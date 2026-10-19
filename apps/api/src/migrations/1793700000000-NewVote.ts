import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The new vote: Best VII of the Day (six starters and a sub) and five more awards. A voter picks
 * six players for the same Best VII category, so one row per voter, category and nominee.
 */
export class NewVote1793700000000 implements MigrationInterface {
  name = 'NewVote1793700000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const value of ['vii', 'vii_sub', 'dribbling', 'smartest', 'engine', 'playmaker', 'movement']) {
      await q.query(`ALTER TYPE "public"."votes_category_enum" ADD VALUE IF NOT EXISTS '${value}'`);
    }
    await q.query(`ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "UQ_votes_session_voter_category"`);
    await q.query(
      `ALTER TABLE "votes" ADD CONSTRAINT "UQ_votes_session_voter_category_nominee" UNIQUE ("session_id", "voter_id", "category", "nominee_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "votes" WHERE "category" IN ('vii', 'vii_sub')`);
    await q.query(`ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "UQ_votes_session_voter_category_nominee"`);
    await q.query(`ALTER TABLE "votes" ADD CONSTRAINT "UQ_votes_session_voter_category" UNIQUE ("session_id", "voter_id", "category")`);
    // Postgres can't drop enum values; the extra ones are harmless if left.
  }
}
