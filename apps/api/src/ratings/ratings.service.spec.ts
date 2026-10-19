import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { VoteCategory } from './entities/vote.entity';
import { localDate } from '../common/time.util';

const HOUR = 3_600_000;

const player = (id: string) => ({ id, firstName: id, lastName: 'X', nickname: null });
const pay = (id: string, extra: Record<string, unknown> = {}) => ({ playerId: id, player: player(id), team: null, captain: false, attendance: null, ...extra });

function game(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    groupId: 'grp',
    date: localDate(0),
    kind: SessionKind.GAME,
    status: SessionStatus.COMPLETED,
    teamCount: 2,
    voteOpensAt: new Date(Date.now() - HOUR),
    votingToken: 'tok',
    group: { id: 'grp', name: 'Saturday Ballers', contributionsVisibility: 'names' },
    payments: [pay('ada', { team: 'A' }), pay('bisi', { team: 'B' }), pay('lanre', { attendance: 'no_show' })],
    ...over,
  };
}

/** The service with in-memory repos: one game, its votes and its scores. */
function setup(session: ReturnType<typeof game>, opts: { votes?: { voterId: string; nomineeId: string; category: VoteCategory }[]; scores?: number } = {}) {
  const votes = (opts.votes ?? []).map((v) => ({ sessionId: session.id, ...v }));
  const qb = { innerJoinAndSelect: () => qb, leftJoinAndSelect: () => qb, where: () => qb, andWhere: () => qb, getOne: async () => session };
  const saved: unknown[] = [];
  const manager = {
    transaction: async (fn: (m: unknown) => Promise<void>) =>
      fn({ delete: async () => undefined, save: async (_e: unknown, rows: unknown) => saved.push(rows), create: (_e: unknown, r: unknown) => r }),
    save: async (rows: unknown) => saved.push(rows),
  };
  const sessionsRepo = { findOne: async () => session, findOneOrFail: async () => session, createQueryBuilder: () => qb, update: async () => undefined, manager };
  const votesRepo = { find: async () => votes, count: async () => votes.length, manager };
  const gamesRepo = { count: async () => opts.scores ?? 0, find: async () => [], save: async (g: unknown) => g, create: (g: unknown) => g };
  const service = new RatingsService(votesRepo as never, gamesRepo as never, sessionsRepo as never, {} as never);
  return { service, saved };
}

describe('the vote', () => {
  it('opens when the game ends, not before', async () => {
    const { service } = setup(game({ status: SessionStatus.UPCOMING, voteOpensAt: null }));
    await expect(service.submitVotes('tok', ['ada'], { potm: 'bisi' })).rejects.toThrow('Voting opens when the game ends');
    expect((await service.getBallot('tok')).notYet).toBe(true);
  });

  it('stays open for 48 hours from full time', async () => {
    expect((await setup(game({ voteOpensAt: new Date(Date.now() - 47 * HOUR) })).service.getBallot('tok')).open).toBe(true);
    expect((await setup(game({ voteOpensAt: new Date(Date.now() - 49 * HOUR) })).service.getBallot('tok')).open).toBe(false);
  });

  it('keeps the old week-long window for games ended before full-time votes', async () => {
    const { service } = setup(game({ voteOpensAt: null, date: localDate(-3) }));
    expect((await service.getBallot('tok')).open).toBe(true);
  });

  it('stops taking votes while a game is reopened', async () => {
    const { service } = setup(game({ status: SessionStatus.UPCOMING }));
    expect((await service.getBallot('tok')).open).toBe(false);
  });

  it('only lets players who came vote', async () => {
    const { service } = setup(game());
    await expect(service.submitVotes('tok', ['lanre'], { potm: 'ada' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.submitVotes('tok', ['ada'], { [VoteCategory.POTM]: 'bisi' })).resolves.toBeDefined();
  });

  it('keeps the results hidden while the vote is open, and shows them after', async () => {
    const ballot = [{ voterId: 'ada', nomineeId: 'bisi', category: VoteCategory.POTM }];
    const open = await setup(game(), { votes: ballot }).service.getPublicResults('tok');
    expect(open.hidden).toBe(true);
    expect(open.ballots).toBe(1);
    expect(open.categories.every((c) => c.standings.length === 0)).toBe(true);

    const closed = await setup(game({ voteOpensAt: new Date(Date.now() - 49 * HOUR) }), { votes: ballot }).service.getPublicResults('tok');
    expect(closed.hidden).toBe(false);
    expect(closed.categories[0].standings[0]).toMatchObject({ playerId: 'bisi', count: 1 });
  });
});

describe('match day teams and scores', () => {
  it('locks the teams once a score is in', async () => {
    const { service } = setup(game(), { scores: 1 });
    await expect(service.setLineup('g1', 'org', { teams: { ada: 'B' } })).rejects.toThrow('Teams are locked');
    await expect(service.setLineup('g1', 'org', { teamCount: 3 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.pickTeam('g1', ['ada'], 'B')).rejects.toThrow('Teams are set');
  });

  it('lets teams change while no score is in', async () => {
    const { service } = setup(game({ status: SessionStatus.UPCOMING, voteOpensAt: null }));
    await expect(service.pickTeam('g1', ['ada'], 'B')).resolves.toMatchObject({ bibsOpen: true });
  });

  it("doesn't take scores before match day", async () => {
    const { service } = setup(game({ status: SessionStatus.UPCOMING, voteOpensAt: null, date: localDate(2) }));
    await expect(service.addGame('g1', 'org', { teamA: 'A', teamB: 'B', scoreA: 1, scoreB: 0 })).rejects.toThrow('Scores open on match day');
  });
});
