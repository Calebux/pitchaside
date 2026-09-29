import { MigrationInterface, QueryRunner } from 'typeorm';

/** Post-match voting: per-game vote links and the votes behind player ratings. */
export class PostMatchVoting1790700000000 implements MigrationInterface {
  name = 'PostMatchVoting1790700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "voting_token" character varying`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sessions_voting_token" ON "sessions" ("voting_token")`);

    await q.query(`DO $$ BEGIN
      CREATE TYPE "public"."votes_category_enum" AS ENUM('potm', 'pace', 'shooting', 'passing', 'defending', 'keeper');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "votes" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "session_id" uuid NOT NULL,
      "voter_id" uuid NOT NULL,
      "category" "public"."votes_category_enum" NOT NULL,
      "nominee_id" uuid NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_votes" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_votes_session_voter_category" UNIQUE ("session_id", "voter_id", "category"),
      CONSTRAINT "FK_votes_session" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_votes_voter" FOREIGN KEY ("voter_id") REFERENCES "players"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_votes_nominee" FOREIGN KEY ("nominee_id") REFERENCES "players"("id") ON DELETE CASCADE
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "votes"`);
    await q.query(`DROP TYPE IF EXISTS "public"."votes_category_enum"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_sessions_voting_token"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "voting_token"`);
  }
}
