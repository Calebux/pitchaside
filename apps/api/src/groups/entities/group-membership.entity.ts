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
   * Money this member has paid that doesn't yet cover a due (e.g. ₦198 toward ₦1,000).
   * Their oldest pending dues are paid from it as soon as it's enough.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  credit: string;

  @CreateDateColumn()
  joinedAt: Date;
}
