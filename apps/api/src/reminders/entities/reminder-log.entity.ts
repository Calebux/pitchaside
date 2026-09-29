import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** One row per reminder sent, so the scheduler never sends the same one twice. */
@Entity('reminder_logs')
export class ReminderLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. "eve:<sessionId>", "ko:<sessionId>", "owe:<paymentId>", "dues3:<paymentId>" */
  @Column({ unique: true })
  key: string;

  @CreateDateColumn()
  createdAt: Date;
}
