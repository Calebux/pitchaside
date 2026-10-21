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
import { Group } from '../../groups/entities/group.entity';

@Entity('group_wallets')
@Unique(['groupId', 'chainFamily'])
export class GroupWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  /** 'evm' | 'tron' | 'solana' */
  @Column({ name: 'chain_family', type: 'varchar', length: 10 })
  chainFamily: string;

  @Index('IDX_group_wallets_address')
  @Column({ type: 'varchar', length: 64 })
  address: string;

  /** HD derivation path index for this wallet. */
  @Column({ name: 'derivation_index', type: 'int' })
  derivationIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
