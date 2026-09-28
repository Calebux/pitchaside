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

  /** Public code used in the group's join / pay link. */
  @Column({ name: 'invite_code', nullable: true, unique: true })
  inviteCode: string;

  /** Dedicated collection account provisioned with Payrep for this group. */
  @Column({ name: 'account_number', nullable: true, unique: true })
  accountNumber: string;

  @Column({ name: 'account_name', nullable: true })
  accountName: string;

  @Column({ name: 'bank_name', nullable: true })
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
