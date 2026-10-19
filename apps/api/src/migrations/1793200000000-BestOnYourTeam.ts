import { MigrationInterface, QueryRunner } from 'typeorm';

/** The ballot's optional second question: each voter's pick of the best player on their own team. */
export class BestOnYourTeam1793200000000 implements MigrationInterface {
  name = 'BestOnYourTeam1793200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE "public"."votes_category_enum" ADD VALUE IF NOT EXISTS 'teammate'`);
  }

  public async down(): Promise<void> {
    // Postgres can't drop a value from an enum; the extra value is harmless if left.
  }
}
