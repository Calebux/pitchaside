import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Players sign in with their email instead of their phone number.
 *
 * - Phone becomes an optional contact field.
 * - A person's key (the `phone_key` columns, which keep their name) becomes
 *   their lower-cased email wherever we know it. Accounts with no email keep
 *   their phone digits and are moved over the first time the person signs in
 *   with the email their organiser has for them.
 */
export class PlayerEmailSignIn1791300000000 implements MigrationInterface {
  name = 'PlayerEmailSignIn1791300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "players" ALTER COLUMN "phone" DROP NOT NULL`);
    await q.query(`ALTER TABLE "player_accounts" ALTER COLUMN "phone" DROP NOT NULL`);

    // Accounts that can move: they have an email nobody else's account uses (the oldest wins a tie).
    await q.query(`CREATE TEMP TABLE "_rekey" ON COMMIT DROP AS
      SELECT DISTINCT ON (lower(trim(a.email))) a.id, a.phone_key AS old_key, lower(trim(a.email)) AS new_key
      FROM "player_accounts" a
      WHERE a.email IS NOT NULL AND trim(a.email) <> '' AND a.phone_key NOT LIKE '%@%'
        AND NOT EXISTS (SELECT 1 FROM "player_accounts" b WHERE b.phone_key = lower(trim(a.email)))
      ORDER BY lower(trim(a.email)), a."createdAt"`);

    // Their devices keep getting push notifications.
    await q.query(`UPDATE "push_subscriptions" s SET "phone_key" = r.new_key FROM "_rekey" r WHERE s."phone_key" = r.old_key`);
    await q.query(`UPDATE "player_accounts" a SET "phone_key" = r.new_key, "email" = r.new_key FROM "_rekey" r WHERE a.id = r.id`);

    // Player sessions and unused codes were issued against phone numbers: sign in again with email.
    await q.query(`UPDATE "refresh_tokens" SET "revoked" = true WHERE "phone_key" IS NOT NULL AND "phone_key" NOT LIKE '%@%'`);
    await q.query(`DELETE FROM "phone_otps" WHERE "phone_key" NOT LIKE '%@%'`);
  }

  public async down(): Promise<void> {
    // Not reversible: accounts created since have no phone number to key on.
  }
}
