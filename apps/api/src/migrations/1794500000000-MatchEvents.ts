import { MigrationInterface, QueryRunner } from 'typeorm';

/** Yellow cards, red cards and saves on match day: one row each, for whoever got or made it. */
export class MatchEvents1794500000000 implements MigrationInterface {
  name = 'MatchEvents1794500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "match_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "kind" varchar(8) NOT NULL,
        "recorded_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_match_events_session" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_match_events_session" ON "match_events" ("session_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "match_events"`);
  }
}
