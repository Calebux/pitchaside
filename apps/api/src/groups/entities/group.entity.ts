import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GroupMembership } from './group-membership.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum PaymentType {
  PER_SESSION = 'per_session',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

/** What players see of a group's contributions: nothing, totals, or totals plus who's paid. */
export type ContributionsVisibility = 'private' | 'totals' | 'names';
export const CONTRIBUTIONS_VISIBILITY: ContributionsVisibility[] = ['private', 'totals', 'names'];

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  schedule: string;

  @Column({ type: 'int' })
  targetPlayers: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  feePerPlayer: number;

  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.PER_SESSION })
  paymentType: PaymentType;

  /**
   * Players confirm each game ("I'm in"); only confirmed players are billed and
   * the game caps at targetPlayers with a waitlist. Off = everyone is billed.
   */
  @Column({ name: 'require_rsvp', default: false })
  requireRsvp: boolean;

  /** Usual kick-off time, 'HH:mm' local — drives game-time reminders. */
  @Column({ name: 'kickoff_time', type: 'varchar', length: 5, nullable: true })
  kickoffTime: string | null;

  /** What players can see of the group's contributions: 'private' | 'totals' | 'names'. */
  @Column({ name: 'contributions_visibility', type: 'varchar', length: 10, default: 'private' })
  contributionsVisibility: ContributionsVisibility;

  /** Public code used in the group's join / pay link. */
  @Column({ name: 'invite_code', nullable: true, unique: true })
  inviteCode: string;

  /** Dedicated collection account provisioned with PulseMFB for this group. */
  @Column({ name: 'account_number', nullable: true, unique: true })
  accountNumber: string;

  @Column({ name: 'account_name', nullable: true })
  accountName: string;

  // The bank was renamed from Pulse to Payrep; older rows still hold the old name
  // until the PayrepBankName migration runs.
  @Column({
    name: 'bank_name',
    nullable: true,
    transformer: { to: (v: string) => v, from: (v: string | null) => (v === 'Pulse Microfinance Bank' ? 'Payrep Microfinance Bank' : v) },
  })
  bankName: string;

  /** Provider-side identifier for the account (for support / reconciliation). */
  @Column({ name: 'account_reference', nullable: true })
  accountReference: string;

  @ManyToOne(() => Organization, (org) => org.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @OneToMany(() => GroupMembership, (membership) => membership.group)
  memberships: GroupMembership[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
