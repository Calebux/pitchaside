import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * A person's PitchAside login. One per phone number, shared by every club
 * they play for (each club still has its own `players` row, linked by phone).
 */
@Entity('player_accounts')
export class PlayerAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Last 10 digits of the phone number — the person's identity. */
  @Column({ name: 'phone_key', unique: true })
  phoneKey: string;

  @Column()
  phone: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  /** Null until they set one (players added by an organiser, or from before passwords). */
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
