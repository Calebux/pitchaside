import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Held money the group keeps (a player's extra that nobody is owed any more), with how much, when
 * and why, so the player can see it in their history.
 */
export class GroupKeptMoney1794900000000 implements MigrationInterface {
  name = 'GroupKeptMoney1794900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "group_kept_money" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "reason" varchar(20) NOT NULL,
        "note" varchar(120),
        "recorded_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_kept_money" PRIMARY KEY ("id"),
        CONSTRAINT "FK_group_kept_money_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_group_kept_money_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_group_kept_money_group_player" ON "group_kept_money" ("group_id", "player_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "group_kept_money"`);
  }
}
