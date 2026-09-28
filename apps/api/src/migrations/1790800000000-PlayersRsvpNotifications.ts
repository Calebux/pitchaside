import { MigrationInterface, QueryRunner } from 'typeorm';

/** Player sign-in codes, RSVPs with waitlists, WhatsApp/SMS outbox and web push subscriptions. */
export class PlayersRsvpNotifications1790800000000 implements MigrationInterface {
  name = 'PlayersRsvpNotifications1790800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "require_rsvp" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "score_bibs" integer`);
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "score_non_bibs" integer`);
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "team" character varying`);

    await q.query(`DO $$ BEGIN
      CREATE TYPE "public"."rsvps_status_enum" AS ENUM('in', 'out', 'waitlist');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`CREATE TABLE IF NOT EXISTS "rsvps" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "session_id" uuid NOT NULL,
      "player_id" uuid NOT NULL,
      "status" "public"."rsvps_status_enum" NOT NULL,
      "status_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_rsvps" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_rsvps_session_player" UNIQUE ("session_id", "player_id"),
      CONSTRAINT "FK_rsvps_session" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_rsvps_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "phone_otps" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "phone_key" character varying NOT NULL,
      "code_hash" character varying NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "attempts" integer NOT NULL DEFAULT 0,
      "used_at" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_phone_otps" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_phone_otps_key_created" ON "phone_otps" ("phone_key", "createdAt")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "outbound_messages" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "organization_id" character varying,
      "player_id" character varying,
      "channel" character varying NOT NULL,
      "to" character varying NOT NULL,
      "kind" character varying NOT NULL,
      "body" text NOT NULL,
      "status" character varying NOT NULL,
      "provider" character varying,
      "error" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_outbound_messages" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_outbound_messages_org_created" ON "outbound_messages" ("organization_id", "createdAt")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "endpoint" text NOT NULL,
      "p256dh" character varying NOT NULL,
      "auth" character varying NOT NULL,
      "player_id" character varying,
      "user_id" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"),
      CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id")
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
    await q.query(`DROP TABLE IF EXISTS "outbound_messages"`);
    await q.query(`DROP TABLE IF EXISTS "phone_otps"`);
    await q.query(`DROP TABLE IF EXISTS "rsvps"`);
    await q.query(`DROP TYPE IF EXISTS "public"."rsvps_status_enum"`);
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "team"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "score_non_bibs"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "score_bibs"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "reminder_sent_at"`);
    await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "require_rsvp"`);
  }
}
