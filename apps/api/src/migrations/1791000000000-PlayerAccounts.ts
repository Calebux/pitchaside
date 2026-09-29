import { MigrationInterface, QueryRunner } from 'typeorm';

/** Player logins: one account per phone number with an optional email and a password. */
export class PlayerAccounts1791000000000 implements MigrationInterface {
  name = 'PlayerAccounts1791000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "player_accounts" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "phone_key" character varying NOT NULL,
      "phone" character varying NOT NULL,
      "first_name" character varying NOT NULL,
      "last_name" character varying NOT NULL,
      "email" character varying,
      "password_hash" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_player_accounts_phone_key" UNIQUE ("phone_key"),
      CONSTRAINT "PK_player_accounts" PRIMARY KEY ("id")
    )`);
    // Existing players get an account (no password yet — they set one on first sign-in).
    await q.query(`INSERT INTO "player_accounts" ("phone_key", "phone", "first_name", "last_name", "email")
      SELECT DISTINCT ON (right(regexp_replace(p.phone, '\\D', '', 'g'), 10))
        right(regexp_replace(p.phone, '\\D', '', 'g'), 10), p.phone, p."firstName", p."lastName", p.email
      FROM "players" p
      WHERE length(regexp_replace(p.phone, '\\D', '', 'g')) >= 10
      ORDER BY right(regexp_replace(p.phone, '\\D', '', 'g'), 10), p."createdAt" DESC
      ON CONFLICT ("phone_key") DO NOTHING`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "player_accounts"`);
  }
}
