import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Person accounts: player phone/email unique per club (was global); organiser phone.
 * - Teams on the day: team_count, session_games (replaces score_bibs/score_non_bibs).
 * - Reminders: groups.kickoff_time, reminder_logs, push_subscriptions.phone_key.
 * Idempotent, like the earlier migrations.
 */
export class AccountsTeamsReminders1790900000000 implements MigrationInterface {
  name = 'AccountsTeamsReminders1790900000000';

  public async up(q: QueryRunner): Promise<void> {
    // ── Catch-up: columns that existed on the entities but were never in a migration ──
    await q.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" character varying`);
    await q.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "state" character varying`);
    await q.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "inviteCode" character varying`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_organizations_invite_code" ON "organizations" ("inviteCode")`);

    // ── Person accounts ──
    await q.query(`ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "UQ_3308d485b3468af160850274e92"`);
    await q.query(`ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "UQ_3abeb86b19703d782f0beff84c0"`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE "players" ADD CONSTRAINT "UQ_players_org_phone" UNIQUE ("organization_id", "phone");
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE "players" ADD CONSTRAINT "UQ_players_org_email" UNIQUE ("organization_id", "email");
    EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" character varying`);

    // ── Teams on the day ──
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "team_count" integer NOT NULL DEFAULT 2`);
    await q.query(`CREATE TABLE IF NOT EXISTS "session_games" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "session_id" uuid NOT NULL,
      "team_a" character varying(1) NOT NULL,
      "team_b" character varying(1) NOT NULL,
      "score_a" integer NOT NULL,
      "score_b" integer NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_session_games" PRIMARY KEY ("id"),
      CONSTRAINT "FK_session_games_session" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE
    )`);
    await q.query(`UPDATE "payments" SET "team" = CASE "team" WHEN 'bibs' THEN 'A' WHEN 'non_bibs' THEN 'B' ELSE "team" END
      WHERE "team" IN ('bibs', 'non_bibs')`);
    // Carry over any bibs-vs-no-bibs scores as a single game, then drop the old columns.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'score_bibs') THEN
        INSERT INTO "session_games" ("session_id", "team_a", "team_b", "score_a", "score_b")
          SELECT "id", 'A', 'B', "score_bibs", "score_non_bibs" FROM "sessions"
          WHERE "score_bibs" IS NOT NULL AND "score_non_bibs" IS NOT NULL;
        ALTER TABLE "sessions" DROP COLUMN "score_bibs";
        ALTER TABLE "sessions" DROP COLUMN "score_non_bibs";
      END IF;
    END $$`);

    // ── Reminders & push ──
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "kickoff_time" character varying(5)`);
    await q.query(`ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "phone_key" character varying`);
    await q.query(`CREATE TABLE IF NOT EXISTS "reminder_logs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "key" character varying NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_reminder_logs_key" UNIQUE ("key"),
      CONSTRAINT "PK_reminder_logs" PRIMARY KEY ("id")
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "reminder_logs"`);
    await q.query(`ALTER TABLE "push_subscriptions" DROP COLUMN IF EXISTS "phone_key"`);
    await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "kickoff_time"`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "score_bibs" integer`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "score_non_bibs" integer`);
    await q.query(`DROP TABLE IF EXISTS "session_games"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "team_count"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
    await q.query(`ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "UQ_players_org_email"`);
    await q.query(`ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "UQ_players_org_phone"`);
    // Restoring global uniqueness would fail if a person now plays for two clubs; left to a manual step.
  }
}
