import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Players removed from a group before removal took them off its games still to come: drop their
 * replies and unpaid places on those games (from tomorrow, Lagos time), so they stop showing in
 * squads, teams and what's owed. Places with any money on them are left for the organiser.
 */
export class RemovedPlayersOffGamesAhead1795100000000 implements MigrationInterface {
  name = 'RemovedPlayersOffGamesAhead1795100000000';

  public async up(q: QueryRunner): Promise<void> {
    const ahead = `s.status = 'upcoming' AND s.date > (now() AT TIME ZONE 'Africa/Lagos')::date`;
    const gone = (alias: string) =>
      `NOT EXISTS (SELECT 1 FROM group_memberships m WHERE m.group_id = s.group_id AND m.player_id = ${alias}.player_id)`;
    await q.query(`DELETE FROM rsvps r USING sessions s WHERE r.session_id = s.id AND ${ahead} AND ${gone('r')}`);
    await q.query(
      `DELETE FROM payments p USING sessions s WHERE p.session_id = s.id AND ${ahead} AND p.status = 'pending' AND COALESCE(p.from_credit, 0) = 0 AND ${gone('p')}`,
    );
  }

  public async down(): Promise<void> {
    // Nothing to put back: these were places for people no longer in the group.
  }
}
