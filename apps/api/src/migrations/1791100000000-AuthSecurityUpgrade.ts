import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSecurityUpgrade1791100000000 implements MigrationInterface {
  name = 'AuthSecurityUpgrade1791100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "refresh_tokens" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid,
      "phone_key" character varying,
      "token_hash" character varying NOT NULL,
      "expires_at" TIMESTAMP NOT NULL,
      "revoked" boolean NOT NULL DEFAULT false,
      "family_id" character varying NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_refresh_tokens_hash" UNIQUE ("token_hash"),
      CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
      CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_family" ON "refresh_tokens" ("family_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user" ON "refresh_tokens" ("user_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_phone_key" ON "refresh_tokens" ("phone_key")`);

    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" character varying`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expires_at" TIMESTAMP`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_expires_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_token"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified"`);
    await q.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
