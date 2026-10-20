import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two things a database first built by `synchronize` (production) can still have, because the
 * migrations that fixed them looked for names only migration-built databases have:
 *
 * 1. The old "one vote per voter per category" unique constraint on votes. NewVote dropped it
 *    by name, but synchronize had given it a generated name, so it stayed, and a Best VII
 *    ballot (six picks in one category) can't be saved. Found here by its columns instead.
 * 2. Players still on the old sides 'bibs' / 'non_bibs' (renamed A / B in a migration that ran
 *    before production used migrations).
 */
export class LiveSchemaFixes1794100000000 implements MigrationInterface {
  name = 'LiveSchemaFixes1794100000000';

  public async up(q: QueryRunner): Promise<void> {
    const old: { conname: string }[] = await q.query(`
      SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'votes' AND c.contype = 'u'
         AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k)
             = ARRAY['category', 'session_id', 'voter_id']`);
    for (const { conname } of old) await q.query(`ALTER TABLE "votes" DROP CONSTRAINT "${conname}"`);

    const [hasNew] = await q.query(`
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'votes' AND c.contype = 'u'
         AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k)
             = ARRAY['category', 'nominee_id', 'session_id', 'voter_id']`);
    if (!hasNew) {
      await q.query(`ALTER TABLE "votes" ADD CONSTRAINT "UQ_votes_session_voter_category_nominee" UNIQUE ("session_id", "voter_id", "category", "nominee_id")`);
    }

    const teams: { count: string }[] = await q.query(
      `WITH moved AS (
         UPDATE "payments" SET "team" = CASE "team" WHEN 'bibs' THEN 'A' ELSE 'B' END
          WHERE "team" IN ('bibs', 'non_bibs') RETURNING 1)
       SELECT count(*) FROM moved`,
    );

    console.log(
      `LiveSchemaFixes: ${old.length} old one-vote-per-category constraint(s) dropped${hasNew ? '' : ', per-nominee constraint added'}; ` +
        `${teams[0]?.count ?? 0} player(s) moved from bibs/non_bibs to A/B`,
    );
  }

  public async down(): Promise<void> {
    // Nothing to put back: the old constraint blocked valid ballots, and A/B are the current sides.
  }
}
