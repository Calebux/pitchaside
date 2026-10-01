import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserBvn1791700000000 implements MigrationInterface {
  name = 'UserBvn1791700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bvn" varchar(11)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bvn"`);
  }
}
