import { Entity, Column, PrimaryColumn } from 'typeorm';

/** Tracks the next available HD derivation index per chain family, so no two groups share an index. */
@Entity('wallet_derivation_counter')
export class WalletDerivationCounter {
  /** 'evm' | 'tron' | 'solana' */
  @PrimaryColumn({ name: 'chain_family', type: 'varchar', length: 10 })
  chainFamily: string;

  @Column({ name: 'next_index', type: 'int', default: 0 })
  nextIndex: number;
}
