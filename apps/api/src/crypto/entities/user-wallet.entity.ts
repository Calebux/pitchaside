import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_wallets')
@Unique(['userId', 'chainFamily'])
export class UserWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  /** 'evm' | 'tron' | 'solana' */
  @Column({ name: 'chain_family', type: 'varchar', length: 10 })
  chainFamily: string;

  @Index('IDX_user_wallets_address')
  @Column({ type: 'varchar', length: 64 })
  address: string;

  /** HD derivation path index for this wallet. */
  @Column({ name: 'derivation_index', type: 'int' })
  derivationIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
