import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { Player } from '../../players/entities/player.entity';

export enum RsvpStatus {
  IN = 'in',
  OUT = 'out',
  /** Wanted in, but the game was full. Promoted in order when someone drops out. */
  WAITLIST = 'waitlist',
}

@Entity('rsvps')
@Unique(['sessionId', 'playerId'])
export class Rsvp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'player_id' })
  playerId: string;

  @Column({ type: 'enum', enum: RsvpStatus })
  status: RsvpStatus;

  /** When they joined the waitlist / last changed — waitlist order. */
  @Column({ name: 'status_at', type: 'timestamptz', default: () => 'now()' })
  statusAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
