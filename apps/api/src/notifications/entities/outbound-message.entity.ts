import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Every WhatsApp / SMS we send (or would send, in mock mode). */
@Entity('outbound_messages')
@Index(['organizationId', 'createdAt'])
export class OutboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ name: 'player_id', nullable: true })
  playerId: string;

  /** 'whatsapp' | 'sms' */
  @Column()
  channel: string;

  @Column()
  to: string;

  /** What triggered it: otp, receipt, dues_open, rsvp_open, vote_open, ... */
  @Column()
  kind: string;

  @Column({ type: 'text' })
  body: string;

  /** 'sent' | 'failed' | 'mock' */
  @Column()
  status: string;

  @Column({ nullable: true })
  provider: string;

  @Column({ nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;
}
