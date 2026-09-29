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
import { SessionGame } from './entities/session-game.entity';

/** Sides on match day. Colours live in the UI (Orange, Yellow, Blue, White, Green, Red). */
export const TEAM_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
type TeamKey = (typeof TEAM_KEYS)[number];

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
  /** Results from games with bibs + score recorded. */
  record: { w: number; d: number; l: number };
  /** Match days finished top of the day's table. */
  teamOfDay: number;
  points: number;
  ovr: number | null;
  attributes: { PAC: number | null; SHO: number | null; PAS: number | null; DEF: number | null; GK: number | null };
}

function emptyVotes(): Record<VoteCategory, number> {
  return { potm: 0, pace: 0, shooting: 0, passing: 0, defending: 0, keeper: 0 };
}

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Vote) private votesRepo: Repository<Vote>,
    @InjectRepository(SessionGame) private gamesRepo: Repository<SessionGame>,
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

  /** Creates the vote link for a game on first use. */
  async ensureVotingToken(sessionId: string) {
    const session = await this.sessionsRepo.findOneOrFail({ where: { id: sessionId } });
    if (!session.votingToken) {
      session.votingToken = randomBytes(6).toString('base64url');
      await this.sessionsRepo.update(session.id, { votingToken: session.votingToken });
    }
    return session.votingToken;
  }

  async getSessionVoting(sessionId: string, organizationId: string) {
    const session = await this.loadSession(sessionId, organizationId);
    session.votingToken = await this.ensureVotingToken(session.id);
    const w = this.window(session);
    return {
      token: session.votingToken,
      open: w.open,
      notYet: w.notYet,
      closesAt: w.closesAt,
      ...(await this.results(session)),
    };
  }

  /** Games this player can vote in right now, and whether they already have. */
  async openVotesFor(playerId: string, organizationId: string) {
    const sessions = await this.gamesQuery(organizationId)
      .innerJoin('session.payments', 'mine', 'mine.playerId = :playerId', { playerId })
      .leftJoinAndSelect('session.group', 'g')
      .getMany();
    const open = sessions.filter((s) => this.window(s).open);
    const result = [];
    for (const s of open) {
      const token = await this.ensureVotingToken(s.id);
      const voted = await this.votesRepo.count({ where: { sessionId: s.id, voterId: playerId } });
      result.push({ token, sessionId: s.id, groupName: s.group?.name, date: s.date, voted: voted > 0 });
    }
    return result;
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

  /** The person's player record on this game's team sheet (they may play for several clubs). */
  private voterIn(session: Session, playerIds: string[]) {
    const voter = (session.payments ?? []).find((p) => playerIds.includes(p.playerId))?.player;
    if (!voter) throw new ForbiddenException("You're not on the team sheet for this game");
    return voter;
  }

  /** The signed-in player's existing picks for this game. */
  async myBallot(token: string, playerIds: string[]) {
    const session = await this.loadSessionByToken(token);
    const voter = this.voterIn(session, playerIds);
    const existing = await this.votesRepo.find({ where: { sessionId: session.id, voterId: voter.id } });
    return {
      playerId: voter.id,
      firstName: voter.firstName,
      picks: Object.fromEntries(existing.map((v) => [v.category, v.nomineeId])),
    };
  }

  async submitVotes(token: string, playerIds: string[], picks: Record<string, string>) {
    const session = await this.loadSessionByToken(token);
    const w = this.window(session);
    if (!w.open) throw new BadRequestException(w.notYet ? 'Voting opens on match day' : 'Voting has closed for this game');

    const voter = this.voterIn(session, playerIds);
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

  // ── Match day: teams on the day + short games ──

  /** Per-side table for one match day: 3 for a win, 1 for a draw. */
  private standings(teamCount: number, games: SessionGame[]) {
    const rows = TEAM_KEYS.slice(0, teamCount).map((team) => ({ team: team as string, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
    const by = new Map<string, (typeof rows)[number]>(rows.map((r) => [r.team, r]));
    for (const g of games) {
      const a = by.get(g.teamA);
      const b = by.get(g.teamB);
      if (!a || !b) continue;
      a.p++; b.p++;
      a.gf += g.scoreA; a.ga += g.scoreB;
      b.gf += g.scoreB; b.ga += g.scoreA;
      if (g.scoreA > g.scoreB) { a.w++; b.l++; a.pts += 3; }
      else if (g.scoreA < g.scoreB) { b.w++; a.l++; b.pts += 3; }
      else { a.d++; b.d++; a.pts++; b.pts++; }
    }
    rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team));
    const top = rows[0];
    // Team of the Day only once games are played and there's a clear leader.
    const teamOfTheDay =
      top && top.p > 0 && (!rows[1] || rows[1].pts < top.pts || (rows[1].gf - rows[1].ga) < (top.gf - top.ga)) ? top.team : null;
    return { rows, teamOfTheDay };
  }

  async getLineup(sessionId: string, organizationId: string) {
    const session = await this.loadSession(sessionId, organizationId);
    const [ovr, games] = await Promise.all([
      this.ovrMap(organizationId),
      this.gamesRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } }),
    ]);
    const table = this.standings(session.teamCount, games);
    return {
      teamCount: session.teamCount,
      squad: (session.payments ?? [])
        .filter((p) => p.player)
        .map((p) => ({
          id: p.player.id,
          firstName: p.player.firstName,
          lastName: p.player.lastName,
          team: p.team && TEAM_KEYS.indexOf(p.team as TeamKey) < session.teamCount ? p.team : null,
          ovr: ovr.get(p.player.id) ?? null,
        })),
      games: games.map((g) => ({ id: g.id, teamA: g.teamA, teamB: g.teamB, scoreA: g.scoreA, scoreB: g.scoreB })),
      standings: table.rows,
      teamOfTheDay: table.teamOfTheDay,
    };
  }

  async setLineup(
    sessionId: string,
    organizationId: string,
    input: { teamCount?: number; teams?: Record<string, string | null> },
  ) {
    const session = await this.loadSession(sessionId, organizationId);
    if (session.kind === SessionKind.DUES) throw new BadRequestException('Dues periods don’t have a lineup');
    let count = session.teamCount;
    if (input.teamCount !== undefined) {
      count = Math.max(2, Math.min(TEAM_KEYS.length, Math.round(input.teamCount)));
      await this.sessionsRepo.update(session.id, { teamCount: count });
      // Anyone on a side that no longer exists goes back to "not picked".
      const dropped = (session.payments ?? []).filter((p) => p.team && TEAM_KEYS.indexOf(p.team as TeamKey) >= count);
      for (const p of dropped) p.team = null;
      if (dropped.length) await this.sessionsRepo.manager.save(dropped);
      await this.gamesRepo
        .createQueryBuilder()
        .delete()
        .where('session_id = :sid', { sid: session.id })
        .andWhere('(team_a IN (:...gone) OR team_b IN (:...gone))', { gone: TEAM_KEYS.slice(count) })
        .execute();
    }
    if (input.teams) {
      const valid = new Set<string>(TEAM_KEYS.slice(0, count));
      const changed = (session.payments ?? []).filter((p) => p.playerId in input.teams!);
      for (const p of changed) {
        const t = input.teams[p.playerId];
        p.team = t && valid.has(t) ? t : null;
      }
      await this.sessionsRepo.manager.save(changed);
    }
    return this.getLineup(sessionId, organizationId);
  }

  /** Snake draft by OVR across N sides so each gets a fair share of the best players. */
  async balanceTeams(sessionId: string, organizationId: string, teamCount?: number) {
    if (teamCount) await this.setLineup(sessionId, organizationId, { teamCount });
    const lineup = await this.getLineup(sessionId, organizationId);
    const n = lineup.teamCount;
    const sorted = [...lineup.squad].sort((a, b) => (b.ovr ?? 60) - (a.ovr ?? 60) || a.firstName.localeCompare(b.firstName));
    const teams: Record<string, string> = {};
    sorted.forEach((p, i) => {
      const round = Math.floor(i / n);
      const pos = i % n;
      teams[p.id] = TEAM_KEYS[round % 2 === 0 ? pos : n - 1 - pos];
    });
    return this.setLineup(sessionId, organizationId, { teams });
  }

  async addGame(
    sessionId: string,
    organizationId: string,
    input: { teamA: string; teamB: string; scoreA: number; scoreB: number },
  ) {
    const session = await this.loadSession(sessionId, organizationId);
    const valid = new Set<string>(TEAM_KEYS.slice(0, session.teamCount));
    if (!valid.has(input.teamA) || !valid.has(input.teamB) || input.teamA === input.teamB) {
      throw new BadRequestException('Pick two different teams');
    }
    const clean = (n: number) => Math.max(0, Math.min(99, Math.round(Number(n) || 0)));
    await this.gamesRepo.save(
      this.gamesRepo.create({
        sessionId: session.id,
        teamA: input.teamA,
        teamB: input.teamB,
        scoreA: clean(input.scoreA),
        scoreB: clean(input.scoreB),
      }),
    );
    return this.getLineup(sessionId, organizationId);
  }

  async deleteGame(sessionId: string, gameId: string, organizationId: string) {
    await this.loadSession(sessionId, organizationId);
    await this.gamesRepo.delete({ id: gameId, sessionId });
    return this.getLineup(sessionId, organizationId);
  }

  private async ovrMap(organizationId: string) {
    const stats = await this.aggregate(await this.gamesQuery(organizationId).getMany());
    return new Map([...stats.entries()].map(([id, s]) => [id, s.ovr]));
  }

  // ── Ratings & league table ──

  /** Aggregates every vote across the given games into per-player ratings. */
  private async aggregate(sessions: Session[]) {
    const stats = new Map<string, PlayerRatings & { player: SquadMember }>();
    if (!sessions.length) return stats;

    const votes = await this.votesRepo.find({ where: { sessionId: In(sessions.map((s) => s.id)) } });
    const allGames = await this.gamesRepo.find({ where: { sessionId: In(sessions.map((s) => s.id)) } });
    const gamesBySession = new Map<string, SessionGame[]>();
    for (const g of allGames) gamesBySession.set(g.sessionId, [...(gamesBySession.get(g.sessionId) ?? []), g]);
    const dayWinner = new Map(
      sessions.map((s) => [s.id, this.standings(s.teamCount, gamesBySession.get(s.id) ?? []).teamOfTheDay] as const),
    );
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
          record: { w: 0, d: 0, l: 0 },
          teamOfDay: 0,
          points: 0,
          ovr: null,
          attributes: { PAC: null, SHO: null, PAS: null, DEF: null, GK: null },
        };
        s.games += 1;
        s.ballotsSeen += voters.size - (voters.has(member.id) ? 1 : 0);
        for (const v of sv) if (v.nomineeId === member.id) s.votes[v.category] += 1;
        if (top > 0 && potmCounts.get(member.id) === top) s.potmWins += 1;
        const team = session.payments?.find((p) => p.playerId === member.id)?.team;
        if (team) {
          for (const g of gamesBySession.get(session.id) ?? []) {
            if (g.teamA !== team && g.teamB !== team) continue;
            const mine = g.teamA === team ? g.scoreA : g.scoreB;
            const theirs = g.teamA === team ? g.scoreB : g.scoreA;
            if (mine > theirs) s.record.w += 1;
            else if (mine === theirs) s.record.d += 1;
            else s.record.l += 1;
          }
          if (dayWinner.get(session.id) === team) s.teamOfDay += 1;
        }
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

  /** A player's recent match days: their side, how the day went, and who won POTM. */
  async recentForPlayer(playerId: string, organizationId: string, limit = 10) {
    const sessions = (
      await this.gamesQuery(organizationId)
        .leftJoinAndSelect('session.group', 'g')
        .orderBy('session.date', 'DESC')
        .getMany()
    )
      .filter((s) => s.payments?.some((p) => p.playerId === playerId))
      .slice(0, limit);
    if (!sessions.length) return [];

    const ids = sessions.map((s) => s.id);
    const [games, votes] = await Promise.all([
      this.gamesRepo.find({ where: { sessionId: In(ids) }, order: { createdAt: 'ASC' } }),
      this.votesRepo.find({ where: { sessionId: In(ids) } }),
    ]);

    return Promise.all(
      sessions.map(async (s) => {
        const myTeam = s.payments?.find((p) => p.playerId === playerId)?.team ?? null;
        const dayGames = games.filter((g) => g.sessionId === s.id);
        const record = { w: 0, d: 0, l: 0 };
        for (const g of dayGames) {
          if (!myTeam || (g.teamA !== myTeam && g.teamB !== myTeam)) continue;
          const mine = g.teamA === myTeam ? g.scoreA : g.scoreB;
          const theirs = g.teamA === myTeam ? g.scoreB : g.scoreA;
          if (mine > theirs) record.w++;
          else if (mine === theirs) record.d++;
          else record.l++;
        }
        const potmCounts = new Map<string, number>();
        const sv = votes.filter((v) => v.sessionId === s.id);
        for (const v of sv) if (v.category === VoteCategory.POTM) potmCounts.set(v.nomineeId, (potmCounts.get(v.nomineeId) ?? 0) + 1);
        const [potmId, potmVotes] = [...potmCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
        const potmPlayer = potmId ? s.payments?.find((p) => p.playerId === potmId)?.player : null;
        const w = this.window(s);
        return {
          sessionId: s.id,
          date: s.date,
          groupName: s.group?.name,
          teamCount: s.teamCount,
          myTeam,
          teamOfTheDay: this.standings(s.teamCount, dayGames).teamOfTheDay,
          record,
          games: dayGames.length,
          potm: potmPlayer ? { name: `${potmPlayer.firstName} ${potmPlayer.lastName}`, votes: potmVotes, isMe: potmId === playerId } : null,
          vote: w.open
            ? { token: await this.ensureVotingToken(s.id), voted: sv.some((v) => v.voterId === playerId) }
            : null,
        };
      }),
    );
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
      record: { w: 0, d: 0, l: 0 },
          teamOfDay: 0,
      points: 0,
      ovr: null,
      attributes: { PAC: null, SHO: null, PAS: null, DEF: null, GK: null },
    };
  }
}
