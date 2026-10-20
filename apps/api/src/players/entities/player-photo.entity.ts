import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * A player's photo: a small square image (resized on the phone before it's sent), kept in the
 * database rather than a file store. Each upload gets a new random key, so its address never
 * changes once served and can be cached for good; the player row points at the current key.
 */
@Entity('player_photos')
export class PlayerPhoto {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  key: string;

  @Column({ type: 'bytea' })
  data: Buffer;

  /** image/jpeg, image/png or image/webp. */
  @Column({ type: 'varchar', length: 20 })
  mime: string;

  @CreateDateColumn()
  createdAt: Date;
}
