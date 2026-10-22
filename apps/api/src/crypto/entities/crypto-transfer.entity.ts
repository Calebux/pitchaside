import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { Player } from '../../players/entities/player.entity';
import { Payment } from '../../payments/entities/payment.entity';

/** Reuse the same statuses as bank transfers so the matching / assignment UI works the same way. */
export enum CryptoTransferStatus {
  MATCHED = 'matched',
  ASSIGNED = 'assigned',
  UNMATCHED = 'unmatched',
  IGNORED = 'ignored',
  OTHER = 'other',
}

export const CRYPTO_MONEY_IN_CATEGORIES = ['organiser', 'sponsor', 'refund', 'other'] as const;
export type CryptoMoneyInCategory = (typeof CRYPTO_MONEY_IN_CATEGORIES)[number];

/** Every incoming USDT/USDC transfer detected by chain monitoring. */
@Entity('crypto_transfers')
@Unique(['txHash', 'chain'])
export class CryptoTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tx_hash', type: 'varchar', length: 128 })
  txHash: string;

  /** 'polygon', 'base', 'tron', etc. */
  @Column({ type: 'varchar', length: 20 })
  chain: string;

  /** 'USDT' | 'USDC' */
  @Column({ type: 'varchar', length: 10 })
  token: string;

  @Column({ name: 'from_address', type: 'varchar', length: 64, nullable: true })
  fromAddress: string | null;

  @Column({ name: 'to_address', type: 'varchar', length: 64 })
  toAddress: string;

  /** 6 decimals (USDT/USDC standard). */
  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: number;

  @ManyToOne(() => Group, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id', nullable: true })
  groupId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Player, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'player_id' })
  player: Player | null;

  @Column({ name: 'player_id', type: 'uuid', nullable: true })
  playerId: string | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @Column({ type: 'enum', enum: CryptoTransferStatus, default: CryptoTransferStatus.UNMATCHED })
  status: CryptoTransferStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  category: CryptoMoneyInCategory | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber: string | null;

  @Column({ type: 'int', default: 0 })
  confirmations: number;

  @Column({ name: 'received_at' })
  receivedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  raw: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
