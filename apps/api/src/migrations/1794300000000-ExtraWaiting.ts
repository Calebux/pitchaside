import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extra money the organiser can't place yet: for someone not in the group, or they don't know
 * who. It waits, apart from the sender's own money, until it's given to a player or put back.
 */
export class ExtraWaiting1794300000000 implements MigrationInterface {
  name = 'ExtraWaiting1794300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "waiting" numeric(12,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "waiting_note" character varying(120)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "group_memberships" DROP COLUMN IF EXISTS "waiting_note"`);
    await q.query(`ALTER TABLE "group_memberships" DROP COLUMN IF EXISTS "waiting"`);
  }
}
