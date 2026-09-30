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

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  /** Provider-side identifier for the account (for support / reconciliation). */
  @Column({ name: 'account_reference', nullable: true })
  accountReference: string;

  /**
   * Who the group usually pays out to — the pitch owner or facility manager. The name
   * is the one the bank returned (NIBSS name enquiry) when the payee was saved.
   */
  @Column({ name: 'payee_label', type: 'varchar', length: 40, nullable: true })
  payeeLabel: string | null;

  @Column({ name: 'payee_name', type: 'varchar', nullable: true })
  payeeName: string | null;

  @Column({ name: 'payee_account', type: 'varchar', length: 10, nullable: true })
  payeeAccount: string | null;

  @Column({ name: 'payee_bank_code', type: 'varchar', length: 10, nullable: true })
  payeeBankCode: string | null;

  @Column({ name: 'payee_bank_name', type: 'varchar', nullable: true })
  payeeBankName: string | null;

  /** The usual amount (e.g. the pitch fee), prefilled when paying the payee. */
  @Column({ name: 'payee_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  payeeAmount: string | null;

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
