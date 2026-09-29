import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';
import { Player } from '../../players/entities/player.entity';

export enum VoteCategory {
  /** Player of the match. */
  POTM = 'potm',
  /** Fastest → PAC */
  PACE = 'pace',
  /** Best finisher → SHO */
  SHOOTING = 'shooting',
  /** Best passer → PAS */
  PASSING = 'passing',
  /** Rock at the back → DEF */
  DEFENDING = 'defending',
  /** Best goalkeeper → GK */
  KEEPER = 'keeper',
}

/** One player's pick for one category in one game. */
@Entity('votes')
@Unique(['sessionId', 'voterId', 'category'])
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voter_id' })
  voter: Player;

  @Column({ name: 'voter_id' })
  voterId: string;

  @Column({ type: 'enum', enum: VoteCategory })
  category: VoteCategory;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nominee_id' })
  nominee: Player;

  @Column({ name: 'nominee_id' })
  nomineeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
