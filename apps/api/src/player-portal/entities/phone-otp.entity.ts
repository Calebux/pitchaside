import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** One-time login codes sent to a player's phone. Only a hash of the code is stored. */
@Entity('phone_otps')
@Index(['phoneKey', 'createdAt'])
export class PhoneOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Last 10 digits of the phone number. */
  @Column({ name: 'phone_key' })
  phoneKey: string;

  @Column({ name: 'code_hash' })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
