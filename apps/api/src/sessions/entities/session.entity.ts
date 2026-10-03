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

  /** "HH:mm" for this game; null means the group's kick-off time. Use kickoffFor(). */
  @Column({ name: 'kickoff_time', type: 'varchar', length: 5, nullable: true })
  kickoffTime: string | null;

  /** How many sides the squad is split into on match day (2–6). */
  @Column({ name: 'team_count', type: 'int', default: 2 })
  teamCount: number;

  /** Set once the day-before reminder has gone out. */
  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

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

/** When a game kicks off ("HH:mm"): its own time, else its group's, else unknown. */
export function kickoffFor(session: Pick<Session, 'kickoffTime'> & { group?: { kickoffTime: string | null } | null }) {
  return session.kickoffTime || session.group?.kickoffTime || null;
}
