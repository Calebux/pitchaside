import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Session, SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { Player } from '../players/entities/player.entity';
import { Vote, VoteCategory } from './entities/vote.entity';

/** Votes stay open for a week after kick-off. */
const VOTING_WINDOW_DAYS = 7;

export const CATEGORIES: { key: VoteCategory; title: string; attr?: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'GK' }[] = [
  { key: VoteCategory.POTM, title: 'Player of the Match' },
  { key: VoteCategory.PACE, title: 'Fastest on the pitch', attr: 'PAC' },
  { key: VoteCategory.SHOOTING, title: 'Best finisher', attr: 'SHO' },
  { key: VoteCategory.PASSING, title: 'Best passer', attr: 'PAS' },
  { key: VoteCategory.DEFENDING, title: 'Rock at the back', attr: 'DEF' },
  { key: VoteCategory.KEEPER, title: 'Best goalkeeper', attr: 'GK' },
];

/** Ratings need a few games of votes before they reach the extremes. */
const RATING_PRIOR = 6;

/** League points: what makes the table move. */
export const POINTS = { potmVote: 3, attrVote: 1, potmWin: 5 };

type SquadMember = Pick<Player, 'id' | 'firstName' | 'lastName'>;

export interface PlayerRatings {
  games: number;
  ballotsSeen: number;
  votes: Record<VoteCategory, number>;
  potmWins: number;
  points: number;
  ovr: number | null;
  attributes: { PAC: number | null; SHO: number | null; PAS: number | null; DEF: number | null; GK: number | null };
}

/** Last 10 digits, so "0803 123 4567" and "+234 803 123 4567" match. */
function phoneKey(phone: string) {
  return phone.replace(/\D/g, '').slice(-10);
}

function emptyVotes(): Record<VoteCategory, number> {
  return { potm: 0, pace: 0, shooting: 0, passing: 0, defending: 0, keeper: 0 };
}

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Vote) private votesRepo: Repository<Vote>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
  ) {}

  // ── Voting window & squad ──

  private window(session: Session) {
    const kickoff = new Date(`${session.date}T00:00:00`);
    const closesAt = new Date(kickoff.getTime() + (VOTING_WINDOW_DAYS + 1) * 86_400_000);
    const now = Date.now();
    const eligible = session.kind !== SessionKind.DUES && session.status !== SessionStatus.CANCELLED;
    return {
      opensAt: kickoff,
      closesAt,
      open: eligible && now >= kickoff.getTime() && now < closesAt.getTime(),
      notYet: eligible && now < kickoff.getTime(),
    };
  }

  /** Everyone with a payment row for the game is in the squad. */
  private squad(session: Session): SquadMember[] {
    return (session.payments ?? [])
      .filter((p) => p.player)
      .map((p) => ({ id: p.player.id, firstName: p.player.firstName, lastName: p.player.lastName }));
  }

  private async loadSessionByToken(token: string) {
    const session = await this.sessionsRepo.findOne({
      where: { votingToken: token },
      relations: ['group', 'payments', 'payments.player'],
    });
    if (!session) throw new NotFoundException('This voting link is invalid');
    return session;
  }

  private async loadSession(id: string, organizationId: string) {
    const session = await this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('session.id = :id', { id })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async results(session: Session) {
    const votes = await this.votesRepo.find({ where: { sessionId: session.id } });
    const squad = this.squad(session);
    const byId = new Map(squad.map((p) => [p.id, p]));
    const ballots = new Set(votes.map((v) => v.voterId)).size;

    const categories = CATEGORIES.map((c) => {
      const counts = new Map<string, number>();
      for (const v of votes) {
        if (v.category === c.key) counts.set(v.nomineeId, (counts.get(v.nomineeId) ?? 0) + 1);
      }
      const standings = [...counts.entries()]
        .map(([playerId, count]) => ({ player: byId.get(playerId) ?? null, playerId, count }))
        .filter((s) => s.player)
        .sort((a, b) => b.count - a.count);
      return { key: c.key, title: c.title, standings };
    });
    return { ballots, squadSize: squad.length, categories };
  }

  // ── Admin ──

  async getSessionVoting(sessionId: string, organizationId: string) {
    const session = await this.loadSession(sessionId, organizationId);
    if (!session.votingToken) {
      session.votingToken = randomBytes(6).toString('base64url');
      await this.sessionsRepo.update(session.id, { votingToken: session.votingToken });
    }
    const w = this.window(session);
    return {
      token: session.votingToken,
      open: w.open,
      notYet: w.notYet,
      closesAt: w.closesAt,
      ...(await this.results(session)),
    };
  }

  // ── Public ballot ──

  async getBallot(token: string) {
    const session = await this.loadSessionByToken(token);
    const w = this.window(session);
    const r = await this.results(session);
    return {
      groupName: session.group?.name,
      date: session.date,
      open: w.open,
      notYet: w.notYet,
      closesAt: w.closesAt,
      categories: CATEGORIES.map(({ key, title }) => ({ key, title })),
      squad: this.squad(session),
      ballots: r.ballots,
      squadSize: r.squadSize,
    };
  }

  private async identify(session: Session, phone: string) {
    const key = phoneKey(phone);
    const voter = (session.payments ?? []).find((p) => p.player && phoneKey(p.player.phone) === key)?.player;
    if (!voter) {
      throw new ForbiddenException("That number isn't on the team sheet for this game");
    }
    return voter;
  }

  async identifyVoter(token: string, phone: string) {
    const session = await this.loadSessionByToken(token);
    const voter = await this.identify(session, phone);
    const existing = await this.votesRepo.find({ where: { sessionId: session.id, voterId: voter.id } });
    return {
      playerId: voter.id,
      firstName: voter.firstName,
      picks: Object.fromEntries(existing.map((v) => [v.category, v.nomineeId])),
    };
  }

  async submitVotes(token: string, phone: string, picks: Record<string, string>) {
    const session = await this.loadSessionByToken(token);
    const w = this.window(session);
    if (!w.open) throw new BadRequestException(w.notYet ? 'Voting opens on match day' : 'Voting has closed for this game');

    const voter = await this.identify(session, phone);
    const squadIds = new Set(this.squad(session).map((p) => p.id));
    const valid = new Set<string>(Object.values(VoteCategory));

    if (!picks[VoteCategory.POTM]) throw new BadRequestException('Pick a Player of the Match');
    const rows: Partial<Vote>[] = [];
    for (const [category, nomineeId] of Object.entries(picks)) {
      if (!nomineeId) continue;
      if (!valid.has(category)) throw new BadRequestException(`Unknown category "${category}"`);
      if (!squadIds.has(nomineeId)) throw new BadRequestException('You can only vote for players in this game');
      if (nomineeId === voter.id) throw new BadRequestException("Nice try — you can't vote for yourself");
      rows.push({ sessionId: session.id, voterId: voter.id, category: category as VoteCategory, nomineeId });
    }

    // Re-voting replaces your previous ballot.
    await this.votesRepo.manager.transaction(async (m) => {
      await m.delete(Vote, { sessionId: session.id, voterId: voter.id });
      await m.save(Vote, rows.map((r) => m.create(Vote, r)));
    });
    return this.results(session);
  }

  async getPublicResults(token: string) {
    const session = await this.loadSessionByToken(token);
    return this.results(session);
  }

  // ── Ratings & league table ──

  /** Aggregates every vote across the given games into per-player ratings. */
  private async aggregate(sessions: Session[]) {
    const stats = new Map<string, PlayerRatings & { player: SquadMember }>();
    if (!sessions.length) return stats;

    const votes = await this.votesRepo.find({ where: { sessionId: In(sessions.map((s) => s.id)) } });
    const votesBySession = new Map<string, Vote[]>();
    for (const v of votes) votesBySession.set(v.sessionId, [...(votesBySession.get(v.sessionId) ?? []), v]);

    for (const session of sessions) {
      const sv = votesBySession.get(session.id) ?? [];
      const voters = new Set(sv.map((v) => v.voterId));

      // Player of the match = most POTM votes (ties share it).
      const potmCounts = new Map<string, number>();
      for (const v of sv) if (v.category === VoteCategory.POTM) potmCounts.set(v.nomineeId, (potmCounts.get(v.nomineeId) ?? 0) + 1);
      const top = Math.max(0, ...potmCounts.values());

      for (const member of this.squad(session)) {
        const s = stats.get(member.id) ?? {
          player: member,
          games: 0,
          ballotsSeen: 0,
          votes: emptyVotes(),
          potmWins: 0,
          points: 0,
          ovr: null,
          attributes: { PAC: null, SHO: null, PAS: null, DEF: null, GK: null },
        };
        s.games += 1;
        s.ballotsSeen += voters.size - (voters.has(member.id) ? 1 : 0);
        for (const v of sv) if (v.nomineeId === member.id) s.votes[v.category] += 1;
        if (top > 0 && potmCounts.get(member.id) === top) s.potmWins += 1;
        stats.set(member.id, s);
      }
    }

    for (const s of stats.values()) {
      const attrVotes = s.votes.pace + s.votes.shooting + s.votes.passing + s.votes.defending + s.votes.keeper;
      s.points = s.votes.potm * POINTS.potmVote + attrVotes * POINTS.attrVote + s.potmWins * POINTS.potmWin;
      if (s.ballotsSeen > 0) {
        // Share of teammates' ballots that picked you, mapped onto a 55–99 card rating.
        // RATING_PRIOR phantom ballots keep one big night from jumping straight to 99.
        const rate = (n: number) =>
          55 + Math.round(44 * Math.min(1, (n / (s.ballotsSeen + RATING_PRIOR)) * 1.5));
        s.attributes = {
          PAC: rate(s.votes.pace),
          SHO: rate(s.votes.shooting),
          PAS: rate(s.votes.passing),
          DEF: rate(s.votes.defending),
          GK: rate(s.votes.keeper),
        };
        // OVR uses a player's best four attributes, so keepers aren't dragged down by SHO and vice versa.
        const a = (Object.values(s.attributes) as number[]).sort((x, y) => y - x).slice(0, 4);
        const potmBoost = Math.min(6, Math.round((s.votes.potm / s.ballotsSeen) * 12));
        s.ovr = Math.min(99, Math.round(a.reduce((x, y) => x + y, 0) / a.length) + potmBoost);
      }
    }
    return stats;
  }

  private gamesQuery(organizationId: string) {
    return this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoin('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('group.organizationId = :organizationId', { organizationId })
      .andWhere('session.kind = :kind', { kind: SessionKind.GAME })
      .andWhere('session.status != :cancelled', { cancelled: SessionStatus.CANCELLED })
      .andWhere('session.date <= CURRENT_DATE');
  }

  async getGroupTable(groupId: string, organizationId: string) {
    const group = await this.groupsRepo.findOne({ where: { id: groupId, organizationId } });
    if (!group) throw new NotFoundException('Group not found');
    const sessions = await this.gamesQuery(organizationId).andWhere('session.groupId = :groupId', { groupId }).getMany();
    const stats = await this.aggregate(sessions);
    const rows = [...stats.values()].sort(
      (a, b) => b.points - a.points || b.votes.potm - a.votes.potm || b.games - a.games,
    );
    return { games: sessions.length, points: POINTS, rows };
  }

  async getPlayerRatings(playerId: string, organizationId: string): Promise<PlayerRatings> {
    const sessions = await this.gamesQuery(organizationId).getMany();
    const mine = sessions.filter((s) => s.payments?.some((p) => p.playerId === playerId));
    const s = (await this.aggregate(mine)).get(playerId);
    if (s) {
      const { player: _player, ...ratings } = s;
      return ratings;
    }
    return {
      games: 0,
      ballotsSeen: 0,
      votes: emptyVotes(),
      potmWins: 0,
      points: 0,
      ovr: null,
      attributes: { PAC: null, SHO: null, PAS: null, DEF: null, GK: null },
    };
  }
}
