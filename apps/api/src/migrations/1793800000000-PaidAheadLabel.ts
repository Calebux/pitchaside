import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Games paid from money a player sent earlier (paid ahead) were labelled the same as games paid by
 * the transfer that came in for them. Marks the past ones: paid by transfer, but no transfer
 * points at them as the game it paid, so the money came from what the player had already sent.
 */
export class PaidAheadLabel1793800000000 implements MigrationInterface {
  name = 'PaidAheadLabel1793800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "payments" p SET "markedBy" = 'credit'
       WHERE p."status" = 'paid' AND p."source" = 'transfer' AND p."markedBy" = 'pulse'
         AND NOT EXISTS (SELECT 1 FROM "bank_transfers" t WHERE t."payment_id" = p."id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "payments" SET "markedBy" = 'pulse' WHERE "source" = 'transfer' AND "markedBy" = 'credit'`);
  }
}
