import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { GroupMembership } from './group-membership.entity';

export enum PaymentType {
  PER_SESSION = 'per_session',
  MONTHLY = 'monthly',
}

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  schedule: string;

  @Column({ type: 'int' })
  targetPlayers: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  feePerPlayer: number;

  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.PER_SESSION })
  paymentType: PaymentType;

  @OneToMany(() => GroupMembership, (membership) => membership.group)
  memberships: GroupMembership[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
