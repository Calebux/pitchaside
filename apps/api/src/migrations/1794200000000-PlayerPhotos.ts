import { MigrationInterface, QueryRunner } from 'typeorm';

/** Player photos: small square images kept in their own table, and each player's current one. */
export class PlayerPhotos1794200000000 implements MigrationInterface {
  name = 'PlayerPhotos1794200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "player_photos" (
      "key" character varying(32) NOT NULL,
      "data" bytea NOT NULL,
      "mime" character varying(20) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_player_photos" PRIMARY KEY ("key")
    )`);
    await q.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "photo_key" character varying(32)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "photo_key"`);
    await q.query(`DROP TABLE IF EXISTS "player_photos"`);
  }
}
