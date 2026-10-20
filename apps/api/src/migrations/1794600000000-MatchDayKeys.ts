import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A key the phone sends with each game, scorer, card or save it records on match day. Sending the
 * same thing again (a retry on a slow connection, a second tap after a timeout) carries the same
 * key, so it's saved once.
 */
export class MatchDayKeys1794600000000 implements MigrationInterface {
  name = 'MatchDayKeys1794600000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const table of ['session_games', 'match_goals', 'match_events']) {
      await q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "client_key" varchar(40)`);
      await q.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_${table}_client_key" ON "${table}" ("session_id", "client_key") WHERE "client_key" IS NOT NULL`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['session_games', 'match_goals', 'match_events']) {
      await q.query(`DROP INDEX IF EXISTS "UQ_${table}_client_key"`);
      await q.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "client_key"`);
    }
  }
}
