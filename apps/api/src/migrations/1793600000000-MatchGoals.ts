import { MigrationInterface, QueryRunner } from 'typeorm';

/** Goals and assists on match day: one row per goal, tied to the short game it was scored in. */
export class MatchGoals1793600000000 implements MigrationInterface {
  name = 'MatchGoals1793600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "match_goals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        "team" varchar(1) NOT NULL,
        "scorer_id" uuid NOT NULL,
        "assist_id" uuid,
        "recorded_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_goals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_match_goals_game" FOREIGN KEY ("game_id") REFERENCES "session_games"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_match_goals_session" ON "match_goals" ("session_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "match_goals"`);
  }
}
