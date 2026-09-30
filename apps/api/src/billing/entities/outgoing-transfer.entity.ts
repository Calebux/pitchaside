import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('outgoing_transfers')
export class OutgoingTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fee: number;

  @Column({ name: 'beneficiary_account' })
  beneficiaryAccount: string;

  @Column({ name: 'beneficiary_name' })
  beneficiaryName: string;

  @Column({ name: 'beneficiary_bank_code', type: 'varchar', length: 10 })
  beneficiaryBankCode: string;

  @Column({ name: 'beneficiary_bank_name' })
  beneficiaryBankName: string;

  @Column({ nullable: true })
  narration: string;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ name: 'provider_reference', nullable: true, unique: true })
  providerReference: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy: User;

  @Column({ name: 'initiated_by_id', nullable: true })
  initiatedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;
}
