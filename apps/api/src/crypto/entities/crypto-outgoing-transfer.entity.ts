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
import { Player } from '../../players/entities/player.entity';

export enum CryptoPayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const CRYPTO_PAYOUT_CATEGORIES = ['pitch', 'footballs', 'bibs', 'water', 'supplies', 'refund', 'other'] as const;
export type CryptoPayoutCategory = (typeof CRYPTO_PAYOUT_CATEGORIES)[number];

@Entity('crypto_outgoing_transfers')
export class CryptoOutgoingTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  /** 'polygon', 'base', 'tron', etc. */
  @Column({ type: 'varchar', length: 20 })
  chain: string;

  /** 'USDT' | 'USDC' */
  @Column({ type: 'varchar', length: 10 })
  token: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  fee: number;

  @Column({ name: 'to_address', type: 'varchar', length: 64 })
  toAddress: string;

  @Column({ name: 'tx_hash', type: 'varchar', length: 128, nullable: true })
  txHash: string | null;

  @Column({ type: 'enum', enum: CryptoPayoutStatus, default: CryptoPayoutStatus.PENDING })
  status: CryptoPayoutStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy: User;

  @Column({ name: 'initiated_by_id', nullable: true })
  initiatedById: string;

  @ManyToOne(() => Player, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'refund_player_id' })
  refundPlayer: Player;

  @Column({ name: 'refund_player_id', type: 'uuid', nullable: true })
  refundPlayerId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  category: CryptoPayoutCategory | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;
}
