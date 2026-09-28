import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum SessionStatus {
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SessionKind {
  /** A match day. */
  GAME = 'game',
  /** A billing period for weekly / monthly / quarterly / annual groups. */
  DUES = 'dues',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  targetAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  collectedAmount: number;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.UPCOMING })
  status: SessionStatus;

  @Column({ type: 'enum', enum: SessionKind, default: SessionKind.GAME })
  kind: SessionKind;

  /** Human label for dues periods, e.g. "October 2026". */
  @Column({ nullable: true })
  label: string;

  /** Public code for the post-match vote link (/v/:token); created on first use. */
  @Column({ name: 'voting_token', nullable: true, unique: true })
  votingToken: string;

  @OneToMany(() => Payment, (payment) => payment.session)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
