import { MigrationInterface, QueryRunner } from 'typeorm';

/** A switch for the match-day timer per group: on for every group, as it is today, until turned off. */
export class GroupTimerSwitch1795200000000 implements MigrationInterface {
  name = 'GroupTimerSwitch1795200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "timer_on" boolean NOT NULL DEFAULT true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "timer_on"`);
  }
}
