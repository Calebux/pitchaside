import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** One-time codes emailed to a player to set or reset their password. Only a hash of the code is stored. */
@Entity('phone_otps')
@Index(['personKey', 'createdAt'])
export class PhoneOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Who the code is for (emailKey). Column name predates email sign-in. */
  @Column({ name: 'phone_key' })
  personKey: string;

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
