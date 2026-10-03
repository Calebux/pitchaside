import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Session, SessionKind, SessionStatus } from './entities/session.entity';
import { NotificationsService } from '../notifications/notifications.service';

const TEAM_NAMES: Record<string, string> = { A: 'Orange', B: 'Yellow', C: 'Blue', D: 'White', E: 'Green', F: 'Red' };
/** Longest a set can run; anything longer is a mistake. */
const MAX_MINUTES = 90;

export type ClockAction =
  | { action: 'start' }
  | { action: 'pause' }
  | { action: 'reset'; minutes?: number }
  | { action: 'adjust'; delta: number }
  | { action: 'teams'; teams: string[] };

/** What every phone shows. Times are server times; `serverNow` lets a phone correct its own clock. */
export interface ClockState {
  minutes: number;
  /** When the running set ends (ISO); null when stopped or paused. */
  endsAt: string | null;
  /** Time left on a paused set. */
  leftMs: number | null;
  teams: string[];
  /** Colours in this game (2–6). */
  teamCount: number;
  label: string;
  updatedAt: string | null;
  serverNow: string;
}

/**
 * One match clock per game, shared by the organiser and everyone in the squad: anyone in the
 * game can start, pause, add time or reset it, and every phone shows the same countdown (the
 * state lives on the session; phones poll it). Each open page beeps at full time; the server
 * also pushes "Time's up" to the squad and the organiser running it, for phones that are locked.
 */
@Injectable()
export class MatchClockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchClockService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    private notifications: NotificationsService,
  ) {}

  /** Clocks still running survive a restart: their full-time pushes are scheduled again. */
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const running = await this.sessionsRepo.find({ where: { clockEndsAt: MoreThan(new Date()) } });
    for (const s of running) this.schedule(s);
  }

  onModuleDestroy() {
    for (const t of this.timers.values()) clearTimeout(t);
  }

  state(s: Session): ClockState {
    const teams = s.clockTeams ? s.clockTeams.split(',').filter(Boolean) : [];
    return {
      minutes: s.clockMinutes ?? 10,
      endsAt: s.clockEndsAt ? new Date(s.clockEndsAt).toISOString() : null,
      leftMs: s.clockLeftMs ?? null,
      teams,
      teamCount: s.teamCount ?? 2,
      label: teams.length === 2 ? `${TEAM_NAMES[teams[0]]} v ${TEAM_NAMES[teams[1]]}` : 'Set',
      updatedAt: s.clockUpdatedAt ? new Date(s.clockUpdatedAt).toISOString() : null,
      serverNow: new Date().toISOString(),
    };
  }

  /** The game, if this organiser's club runs it. */
  async forOrganiser(sessionId: string, organizationId: string) {
    const s = await this.sessionsRepo
      .createQueryBuilder('s')
      .innerJoin('s.group', 'g')
      .where('s.id = :sessionId', { sessionId })
      .andWhere('g.organizationId = :organizationId', { organizationId })
      .getOne();
    return this.game(s);
  }

  /** The game, if one of this person's player records is in its squad. */
  async forPlayer(sessionId: string, playerIds: string[]) {
    const s = await this.sessionsRepo.findOne({ where: { id: sessionId }, relations: ['payments'] });
    if (s && !s.payments?.some((p) => playerIds.includes(p.playerId))) throw new NotFoundException("You're not in this game");
    return this.game(s);
  }

  private game(s: Session | null) {
    if (!s || s.kind === SessionKind.DUES) throw new NotFoundException('Game not found');
    return s;
  }

  async act(s: Session, input: ClockAction, by: { userId?: string } = {}) {
    if (s.status === SessionStatus.CANCELLED) throw new BadRequestException('This game was called off');
    const now = Date.now();
    const running = s.clockEndsAt && new Date(s.clockEndsAt).getTime() > now;
    const minutes = s.clockMinutes ?? 10;

    switch (input.action) {
      case 'start':
        if (!running) {
          const left = s.clockLeftMs ?? minutes * 60_000;
          s.clockEndsAt = new Date(now + left);
          s.clockLeftMs = null;
        }
        break;
      case 'pause':
        if (running) {
          s.clockLeftMs = Math.max(0, new Date(s.clockEndsAt!).getTime() - now);
          s.clockEndsAt = null;
        }
        break;
      case 'reset':
        s.clockMinutes = clampMinutes(input.minutes ?? minutes);
        s.clockEndsAt = null;
        s.clockLeftMs = null;
        break;
      case 'adjust': {
        const delta = Math.max(-30, Math.min(30, Math.round(input.delta))) * 60_000;
        if (running) s.clockEndsAt = new Date(Math.max(now + 1000, new Date(s.clockEndsAt!).getTime() + delta));
        else if (s.clockLeftMs != null) s.clockLeftMs = Math.max(1000, s.clockLeftMs + delta);
        else s.clockMinutes = clampMinutes(minutes + delta / 60_000);
        break;
      }
      case 'teams': {
        const valid = input.teams.filter((t) => t in TEAM_NAMES && t <= String.fromCharCode(64 + (s.teamCount ?? 2)));
        s.clockTeams = [...new Set(valid)].slice(-2).join(',') || null;
        break;
      }
    }
    if (by.userId) s.clockUserId = by.userId;
    s.clockUpdatedAt = new Date();
    await this.sessionsRepo.update(s.id, {
      clockMinutes: s.clockMinutes,
      clockEndsAt: s.clockEndsAt,
      clockLeftMs: s.clockLeftMs,
      clockTeams: s.clockTeams,
      clockUserId: s.clockUserId,
      clockUpdatedAt: s.clockUpdatedAt,
    });
    this.schedule(s);
    return this.state(s);
  }

  /** (Re)arm the full-time push for the clock as it now stands; a stopped clock has none. */
  private schedule(s: Session) {
    const old = this.timers.get(s.id);
    if (old) clearTimeout(old);
    this.timers.delete(s.id);
    if (!s.clockEndsAt) return;
    const endsAt = new Date(s.clockEndsAt).getTime();
    const ms = endsAt - Date.now();
    if (ms <= 0 || ms > MAX_MINUTES * 60_000) return;
    const timer = setTimeout(() => {
      this.timers.delete(s.id);
      this.fullTime(s.id, endsAt).catch((err) => this.logger.warn(`Full-time push failed: ${err.message}`));
    }, ms);
    timer.unref();
    this.timers.set(s.id, timer);
  }

  private async fullTime(sessionId: string, endsAt: number) {
    const s = await this.sessionsRepo.findOne({ where: { id: sessionId }, relations: ['payments'] });
    // Paused, reset or given more time since: that change has its own timer.
    if (!s?.clockEndsAt || new Date(s.clockEndsAt).getTime() !== endsAt) return;
    const label = this.state(s).label;
    const notice = { kind: 'match_clock', title: "⏱ Time's up!", body: `${label} — full time.` };
    await this.notifications.pushToPlayers(
      (s.payments ?? []).map((p) => p.playerId),
      { ...notice, url: `/me/games/${s.id}/clock` },
    );
    if (s.clockUserId) await this.notifications.pushToUser(s.clockUserId, { ...notice, url: `/sessions/${s.id}?tab=clock` });
  }

  /** For tests and diagnostics. */
  scheduledFor(sessionIds: string[]) {
    return sessionIds.filter((id) => this.timers.has(id));
  }
}

function clampMinutes(m: number) {
  return Math.max(1, Math.min(MAX_MINUTES, Math.round(m)));
}

