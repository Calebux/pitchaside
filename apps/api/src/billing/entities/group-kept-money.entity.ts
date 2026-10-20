import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { Player } from '../../players/entities/player.entity';

/** Why held money stayed with the group. `player_gave`: the player offered it and the organiser accepted. */
export const KEPT_REASONS = ['player_agreed', 'player_gave', 'unreachable', 'sorted_in_person', 'other'] as const;
export type KeptReason = (typeof KEPT_REASONS)[number];

/**
 * Money a player sent beyond what they owed that the group keeps: nobody owes anybody for it any
 * more. One row each time, so the player sees how much, when and why in their payment history.
 * The group's balance doesn't change (that money was already in the account), only who it's for.
 */
@Entity('group_kept_money')
@Index(['groupId', 'playerId'])
export class GroupKeptMoney {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'player_id' })
  playerId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 20 })
  reason: KeptReason;

  /** In the organiser's words, for "other" (and optional otherwise). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  note: string | null;

  /** The organiser user who kept it. */
  @Column({ name: 'recorded_by', type: 'varchar', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
