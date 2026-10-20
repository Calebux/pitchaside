import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';

export const MATCH_EVENT_KINDS = ['yellow', 'red', 'save'] as const;
export type MatchEventKind = (typeof MATCH_EVENT_KINDS)[number];

/**
 * Something one player got or did on match day that isn't a goal: a yellow card, a red card, or
 * a save. One row each. `recordedBy` is who wrote it down, like goals.
 */
@Entity('match_events')
@Index(['sessionId'])
export class MatchEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId: string;

  @Column({ type: 'varchar', length: 8 })
  kind: MatchEventKind;

  /** "Tunde (organiser)", "Ada (captain)". */
  @Column({ name: 'recorded_by', type: 'varchar', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
