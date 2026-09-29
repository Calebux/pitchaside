import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { Player } from '../players/entities/player.entity';
import { User } from '../users/entities/user.entity';
import { OutboundMessage } from './entities/outbound-message.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { Channel, MESSAGING_PROVIDER, MessagingProvider } from './providers/messaging.provider';

export interface Notice {
  /** Push title. */
  title: string;
  /** Push body; also the WhatsApp/SMS text unless `message` is given. */
  body: string;
  /** Path in the web app to open, e.g. "/me". */
  url?: string;
  /** Analytics / outbox label: receipt, dues_open, rsvp_open, vote_open, ... */
  kind: string;
  /** Longer WhatsApp/SMS text (can include account numbers, links). */
  message?: string;
  /** Always send WhatsApp/SMS too, even if the player has push. */
  critical?: boolean;
}

export interface PushInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private pushEnabled = false;

  constructor(
    @InjectRepository(OutboundMessage) private messagesRepo: Repository<OutboundMessage>,
    @InjectRepository(PushSubscriptionEntity) private subsRepo: Repository<PushSubscriptionEntity>,
    @InjectRepository(Player) private playersRepo: Repository<Player>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @Inject(MESSAGING_PROVIDER) private messaging: MessagingProvider,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (pub && priv) {
      webpush.setVapidDetails(this.config.get('VAPID_SUBJECT', 'mailto:hello@pitchaside.app'), pub, priv);
      this.pushEnabled = true;
    } else {
      this.logger.warn('VAPID keys not set — push notifications disabled');
    }
  }

  get messagingMode() {
    return this.messaging.mode;
  }

  appUrl(path = '') {
    return `${this.config.get('APP_URL', 'http://localhost:3000')}${path}`;
  }

  publicKey() {
    return { publicKey: this.pushEnabled ? this.config.get<string>('VAPID_PUBLIC_KEY') : null };
  }

  // ── WhatsApp / SMS ──

  async sendMessage(input: {
    to: string;
    body: string;
    kind: string;
    channel?: Channel;
    playerId?: string;
    organizationId?: string;
  }) {
    const channel = input.channel ?? (this.config.get<Channel>('MESSAGING_OTP_CHANNEL', 'whatsapp'));
    const record = this.messagesRepo.create({
      organizationId: input.organizationId,
      playerId: input.playerId,
      channel,
      to: input.to,
      kind: input.kind,
      body: input.body,
      provider: this.messaging.name,
      status: this.messaging.mode === 'mock' ? 'mock' : 'sent',
    });
    try {
      await this.messaging.send({ to: input.to, body: input.body, channel });
    } catch (err: any) {
      record.status = 'failed';
      record.error = String(err.message).slice(0, 250);
      this.logger.warn(`Message to ${input.to} failed: ${err.message}`);
    }
    return this.messagesRepo.save(record);
  }

  listMessages(organizationId: string) {
    return this.messagesRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // ── Push ──

  async subscribe(sub: PushInput, owner: { playerId?: string; userId?: string }) {
    const existing = await this.subsRepo.findOne({ where: { endpoint: sub.endpoint } });
    const row = existing ?? this.subsRepo.create({ endpoint: sub.endpoint });
    row.p256dh = sub.keys.p256dh;
    row.auth = sub.keys.auth;
    row.playerId = owner.playerId ?? (null as unknown as string);
    row.userId = owner.userId ?? (null as unknown as string);
    await this.subsRepo.save(row);
    return { subscribed: true };
  }

  async unsubscribe(endpoint: string) {
    await this.subsRepo.delete({ endpoint });
    return { subscribed: false };
  }

  private async push(subs: PushSubscriptionEntity[], notice: Pick<Notice, 'title' | 'body' | 'url' | 'kind'>) {
    if (!this.pushEnabled || !subs.length) return 0;
    const payload = JSON.stringify({ title: notice.title, body: notice.body, url: notice.url ?? '/', tag: notice.kind });
    let delivered = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 24,
          });
          delivered++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) await this.subsRepo.delete({ id: s.id });
          else this.logger.warn(`Push failed: ${err.statusCode ?? ''} ${err.message}`);
        }
      }),
    );
    return delivered;
  }

  // ── High level ──

  /** Push first; WhatsApp/SMS when the player has no push device, or always if critical. */
  async notifyPlayers(playerIds: string[], notice: Notice) {
    const ids = [...new Set(playerIds.filter(Boolean))];
    if (!ids.length) return;
    const [players, subs] = await Promise.all([
      this.playersRepo.find({ where: { id: In(ids) } }),
      this.subsRepo.find({ where: { playerId: In(ids) } }),
    ]);
    for (const player of players) {
      const mine = subs.filter((s) => s.playerId === player.id);
      const pushed = await this.push(mine, notice);
      if (notice.critical || pushed === 0) {
        await this.sendMessage({
          to: player.phone,
          body: notice.message ?? `${notice.title}\n${notice.body}${notice.url ? `\n${this.appUrl(notice.url)}` : ''}`,
          kind: notice.kind,
          playerId: player.id,
          organizationId: player.organizationId,
        });
      }
    }
  }

  /** Push to everyone who runs this organisation (organisers don't get WhatsApp spam). */
  async notifyOrganisers(organizationId: string, notice: Pick<Notice, 'title' | 'body' | 'url' | 'kind'>) {
    const users = await this.usersRepo.find({ where: { organizationId } });
    if (!users.length) return;
    const subs = await this.subsRepo.find({ where: { userId: In(users.map((u) => u.id)) } });
    await this.push(subs, notice);
  }

  /** Fire-and-forget wrapper so a notification problem never breaks the request. */
  later(fn: () => Promise<unknown>) {
    fn().catch((err) => this.logger.warn(`Notification failed: ${err?.message ?? err}`));
  }
}
