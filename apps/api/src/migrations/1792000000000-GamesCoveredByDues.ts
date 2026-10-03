import { MigrationInterface, QueryRunner } from 'typeorm';

const PERIODIC = `('weekly', 'monthly', 'quarterly', 'annually')`;

/**
 * Groups that collect dues per period were also being charged the fee for every game. Their
 * unpaid game charges become ₦0 entries covered by dues (paid ones are left for the organiser
 * to refund or waive), and their games no longer expect money of their own.
 */
export class GamesCoveredByDues1792000000000 implements MigrationInterface {
  name = 'GamesCoveredByDues1792000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "payments" p
         SET "status" = 'waived', "amount" = 0, "source" = 'dues', "markedBy" = NULL
        FROM "sessions" s
        JOIN "groups" g ON g."id" = s."group_id"
       WHERE p."session_id" = s."id"
         AND s."kind" = 'game'
         AND g."paymentType" IN ${PERIODIC}
         AND p."status" = 'pending'`);
    await q.query(`
      UPDATE "sessions" s
         SET "targetAmount" = 0
        FROM "groups" g
       WHERE g."id" = s."group_id"
         AND s."kind" = 'game'
         AND g."paymentType" IN ${PERIODIC}`);
  }

  public async down(): Promise<void> {
    // The old charges were the bug; nothing to restore.
  }
}
