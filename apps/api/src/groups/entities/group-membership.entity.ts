import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Group } from './group.entity';
import { Player } from '../../players/entities/player.entity';

export enum MemberRole {
  ORGANIZER = 'organizer',
  PLAYER = 'player',
}

@Entity('group_memberships')
@Unique(['group', 'player'])
export class GroupMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, (group) => group.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Player, (player) => player.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'player_id' })
  playerId: string;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.PLAYER })
  role: MemberRole;

  /** Short code members put in their transfer narration so we can match payments. */
  @Column({ name: 'payment_ref', nullable: true, unique: true })
  paymentRef: string;

  /**
   * Money kept for this member's games: part of a due (e.g. ₦198 toward ₦1,000), what they paid
   * for a game that was called off, or extra the organiser chose to keep for them. It pays their
   * played games and their next one as soon as it covers a due, never games further ahead.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  credit: string;

  /**
   * Money this member sent beyond what they owed: for a friend, a wrong amount, or ahead. It's
   * never used on its own. The organiser sorts it: someone else's games, kept for this member's
   * next game (it then moves to credit), or sent back.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  extra: string;

  /**
   * Extra this member sent for someone the organiser can't place yet: not in the group, or no
   * one knows who. It isn't this member's money and pays nothing until it's given to a player
   * or put back with their extra.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  waiting: string;

  /** What the organiser knows about who the waiting money is for, e.g. "Kunle's friend". */
  @Column({ name: 'waiting_note', type: 'varchar', length: 120, nullable: true })
  waitingNote: string | null;

  @CreateDateColumn()
  joinedAt: Date;
}
