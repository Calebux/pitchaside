import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

/** Longest a set can run on the clock; anything longer is a mistake. */
const MAX_MS = 3 * 60 * 60 * 1000;

/**
 * Full-time buzz for the match clock. The page beeps and vibrates while it's open, but a
 * locked phone only buzzes for a push notification — so the server sends one when the
 * time is up. Timers live in memory: a restart mid-set loses the push, not the on-page alarm.
 */
@Injectable()
export class MatchClockService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchClockService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private notifications: NotificationsService) {}

  /** Push to this organiser's devices at `endsAt`; replaces any clock they had running on the game. */
  start(sessionId: string, userId: string, endsAt: Date, label: string) {
    this.stop(sessionId, userId);
    const ms = endsAt.getTime() - Date.now();
    if (!(ms > 0) || ms > MAX_MS) return { scheduled: false };
    const timer = setTimeout(() => {
      this.timers.delete(this.key(sessionId, userId));
      this.notifications
        .pushToUser(userId, {
          kind: 'match_clock',
          title: "⏱ Time's up!",
          body: `${label} — full time. Tap to record the score.`,
          url: `/sessions/${sessionId}?tab=teams`,
        })
        .catch((err) => this.logger.warn(`Match clock push failed: ${err.message}`));
    }, ms);
    timer.unref();
    this.timers.set(this.key(sessionId, userId), timer);
    return { scheduled: true };
  }

  stop(sessionId: string, userId: string) {
    const key = this.key(sessionId, userId);
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
    return { scheduled: false };
  }

  onModuleDestroy() {
    for (const t of this.timers.values()) clearTimeout(t);
  }

  private key(sessionId: string, userId: string) {
    return `${sessionId}:${userId}`;
  }
}
