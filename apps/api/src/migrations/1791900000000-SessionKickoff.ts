import { MigrationInterface, QueryRunner } from 'typeorm';

/** A game's own kick-off time; when empty, the group's kick-off time applies. */
export class SessionKickoff1791900000000 implements MigrationInterface {
  name = 'SessionKickoff1791900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "kickoff_time" varchar(5)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "kickoff_time"`);
  }
}
