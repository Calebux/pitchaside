import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from '../../groups/entities/group.entity';
import { Player } from '../../players/entities/player.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  state: string;

  @Column({ unique: true, nullable: true })
  inviteCode: string;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Group, (group) => group.organization)
  groups: Group[];

  @OneToMany(() => Player, (player) => player.organization)
  players: Player[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
