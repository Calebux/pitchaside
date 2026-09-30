import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * A person's PitchAside login. One per email address, shared by every club
 * they play for (each club still has its own `players` row, linked by email).
 */
@Entity('player_accounts')
export class PlayerAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The person's identity: their lower-cased email (see emailKey). The column
   * keeps its old name — accounts created before email sign-in hold phone
   * digits here until the person first signs in with their email.
   */
  @Column({ name: 'phone_key', unique: true })
  personKey: string;

  /** Optional contact number; no longer used to sign in. */
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

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
