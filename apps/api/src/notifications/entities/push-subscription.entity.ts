import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** A browser/device that asked for push notifications — a player's or an organiser's. */
@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'text' })
  endpoint: string;

  @Column()
  p256dh: string;

  @Column()
  auth: string;

  @Column({ name: 'player_id', nullable: true })
  playerId: string;

  /** Person-level owner (their emailKey): reaches every team they play in. Column name predates email sign-in. */
  @Column({ name: 'phone_key', nullable: true })
  personKey: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
