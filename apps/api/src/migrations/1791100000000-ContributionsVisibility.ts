import { MigrationInterface, QueryRunner } from 'typeorm';

/** Organisers choose what players see of a group's contributions. */
export class ContributionsVisibility1791100000000 implements MigrationInterface {
  name = 'ContributionsVisibility1791100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "contributions_visibility" character varying(10) NOT NULL DEFAULT 'private'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "contributions_visibility"`);
  }
}
