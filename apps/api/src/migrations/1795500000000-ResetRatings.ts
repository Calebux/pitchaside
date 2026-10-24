import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wipe all rating-feeding data for launch.
 *
 * Deletes match goals, match events, votes and session games, then clears
 * player levels so everyone starts fresh at the new 50-point baseline.
 * Sessions (payments, attendance) are preserved.
 */
export class ResetRatings1795500000000 implements MigrationInterface {
  name = 'ResetRatings1795500000000';

  public async up(q: QueryRunner): Promise<void> {
    // Order matters for foreign keys
    await q.query(`DELETE FROM match_goals`);
    await q.query(`DELETE FROM match_events`);
    await q.query(`DELETE FROM votes`);
    await q.query(`DELETE FROM session_games`);
    await q.query(`UPDATE players SET level = NULL`);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // One-way wipe by design — nothing to restore.
  }
}
