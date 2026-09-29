import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { Player } from '../../players/entities/player.entity';

export enum PaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
  WAIVED = 'waived',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, (session) => session.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => Player, (player) => player.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'player_id' })
  playerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  markedBy: string;

  /** 'manual' when an admin marked it, 'transfer' when reconciled from a bank transfer. */
  @Column({ nullable: true })
  source: string;

  /** Match-day side for games: 'bibs' | 'non_bibs' (null = not picked yet). */
  @Column({ type: 'varchar', nullable: true })
  team: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
