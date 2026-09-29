import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';

/**
 * One short game on match day between two of the session's sides
 * (winner-stays-on or round robin — the app doesn't mind).
 */
@Entity('session_games')
export class SessionGame {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'team_a', type: 'varchar', length: 1 })
  teamA: string;

  @Column({ name: 'team_b', type: 'varchar', length: 1 })
  teamB: string;

  @Column({ name: 'score_a', type: 'int' })
  scoreA: number;

  @Column({ name: 'score_b', type: 'int' })
  scoreB: number;

  @CreateDateColumn()
  createdAt: Date;
}
