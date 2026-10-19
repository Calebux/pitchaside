import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { SessionKind, SessionStatus } from '../sessions/entities/session.entity';
import { VoteCategory } from './entities/vote.entity';
import { localDate } from '../common/time.util';
import { DEFAULT_START, cardRating } from './skill';

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
    voteClosedAt: null as Date | null,
    votingToken: 'tok',
    group: { id: 'grp', name: 'Saturday Ballers', contributionsVisibility: 'names' },
    payments: [pay('ada', { team: 'A' }), pay('bisi', { team: 'B' }), pay('lanre', { attendance: 'no_show' })],
    ...over,
  };
}

/** The service with in-memory repos: one game, its votes and its scores. */
function setup(
  session: ReturnType<typeof game>,
  opts: {
    votes?: { voterId: string; nomineeId: string; category: VoteCategory }[];
    scores?: number;
    games?: { teamA: string; teamB: string; scoreA: number; scoreB: number }[];
  } = {},
) {
  const votes = (opts.votes ?? []).map((v) => ({ sessionId: session.id, ...v }));
  const qb = {
    innerJoin: () => qb,
    innerJoinAndSelect: () => qb,
    leftJoinAndSelect: () => qb,
    where: () => qb,
    andWhere: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    getOne: async () => session,
    getMany: async () => [session],
  };
  const games = (opts.games ?? []).map((g) => ({ sessionId: session.id, ...g }));
  const saved: unknown[] = [];
  const manager = {
    transaction: async (fn: (m: unknown) => Promise<void>) =>
      fn({ delete: async () => undefined, save: async (_e: unknown, rows: unknown) => saved.push(rows), create: (_e: unknown, r: unknown) => r }),
    save: async (rows: unknown) => saved.push(rows),
    find: async () => [],
  };
  const sessionsRepo = { findOne: async () => session, findOneOrFail: async () => session, createQueryBuilder: () => qb, update: async () => undefined, manager };
  const votesRepo = { find: async () => votes, count: async () => votes.length, manager };
  const gamesRepo = { count: async () => opts.scores ?? games.length, find: async () => games, save: async (g: unknown) => g, create: (g: unknown) => g };
  const groupsRepo = { findOne: async () => session.group };
  const service = new RatingsService(votesRepo as never, gamesRepo as never, sessionsRepo as never, groupsRepo as never);
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

describe('the table', () => {
  // Ada (orange) beat Bisi (blue) 2–1, then they drew 1–1; Lanre didn't come.
  const day = [
    { teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1 },
    { teamA: 'A', teamB: 'B', scoreA: 1, scoreB: 1 },
  ];

  it('gives 3 for a win, 1 for a draw and 2 for Team of the Day', async () => {
    const { rows } = await setup(game({ voteOpensAt: new Date(Date.now() - 49 * HOUR) }), { games: day }).service.getGroupTable('grp', 'org');
    const ada = rows.find((r) => r.player.id === 'ada')!;
    const bisi = rows.find((r) => r.player.id === 'bisi')!;
    expect(ada).toMatchObject({ record: { w: 1, d: 1, l: 0 }, teamOfDay: 1, points: 3 + 1 + 2 });
    expect(bisi).toMatchObject({ record: { w: 0, d: 1, l: 1 }, teamOfDay: 0, points: 1 });
    expect(rows.map((r) => r.player.id)).toEqual(['ada', 'bisi']);
  });

  it('adds 3 for Player of the Match once the vote closes; other votes earn no points', async () => {
    const votes = [
      { voterId: 'ada', nomineeId: 'bisi', category: VoteCategory.POTM },
      { voterId: 'bisi', nomineeId: 'ada', category: VoteCategory.PACE },
      { voterId: 'bisi', nomineeId: 'ada', category: VoteCategory.SHOOTING },
    ];
    const closed = await setup(game({ voteOpensAt: new Date(Date.now() - 49 * HOUR) }), { games: day, votes }).service.getGroupTable('grp', 'org');
    expect(closed.rows.find((r) => r.player.id === 'bisi')).toMatchObject({ potmWins: 1, points: 1 + 3 });
    expect(closed.rows.find((r) => r.player.id === 'ada')).toMatchObject({ points: 6 });

    const open = await setup(game(), { games: day, votes }).service.getGroupTable('grp', 'org');
    expect(open.rows.find((r) => r.player.id === 'bisi')).toMatchObject({ potmWins: 0, points: 1 });
  });

  it("leaves out players who didn't come", async () => {
    const { rows } = await setup(game(), { games: day }).service.getGroupTable('grp', 'org');
    expect(rows.some((r) => r.player.id === 'lanre')).toBe(false);
  });
});

describe('the one-question ballot', () => {
  it('asks Player of the Match, with each player\'s team', async () => {
    const b = await setup(game({ payments: [pay('ada', { team: 'A', captain: true }), pay('bisi', { team: 'B' }), pay('lanre', { attendance: 'no_show' })] })).service.getBallot('tok');
    expect(b.categories[0].key).toBe(VoteCategory.POTM);
    expect(b.squad.map((p) => [p.id, p.team])).toEqual([
      ['ada', 'A'],
      ['bisi', 'B'],
    ]);
    expect(b.captains).toEqual({ A: 'ada' });
  });

  it('closes once everyone who came has voted, and shows the result', async () => {
    const ballots = [
      { voterId: 'ada', nomineeId: 'bisi', category: VoteCategory.POTM },
      { voterId: 'bisi', nomineeId: 'ada', category: VoteCategory.POTM },
    ];
    const session = game();
    const res = await setup(session, { votes: ballots }).service.submitVotes('tok', ['ada'], { potm: 'bisi' });
    expect(session.voteClosedAt).toBeInstanceOf(Date);
    expect(res.hidden).toBe(false);
  });

  it('also closes early on a game with the older week-long window', async () => {
    const legacy = game({ voteOpensAt: null, voteClosedAt: new Date(Date.now() - 1000) });
    const r = await setup(legacy, { votes: [{ voterId: 'ada', nomineeId: 'bisi', category: VoteCategory.POTM }] }).service.getPublicResults('tok');
    expect(r.hidden).toBe(false);
  });

  it('stays open while someone who came still has to vote', async () => {
    const session = game();
    const res = await setup(session, { votes: [{ voterId: 'ada', nomineeId: 'bisi', category: VoteCategory.POTM }] }).service.submitVotes('tok', ['ada'], { potm: 'bisi' });
    expect(session.voteClosedAt ?? null).toBeNull();
    expect(res.hidden).toBe(true);
  });

  it("doesn't pull card attributes down when the ballot only asked Player of the Match", async () => {
    const votes = [
      { voterId: 'ada', nomineeId: 'bisi', category: VoteCategory.POTM },
      { voterId: 'bisi', nomineeId: 'ada', category: VoteCategory.POTM },
    ];
    const { rows } = await setup(game({ voteOpensAt: new Date(Date.now() - 49 * HOUR) }), { votes }).service.getGroupTable('grp', 'org');
    for (const r of rows) {
      const a = Object.values(r.attributes);
      expect(new Set(a).size).toBe(1);
      expect(a[0]).toBe(cardRating(DEFAULT_START));
    }
  });
});

describe('best on your team', () => {
  const four = () =>
    game({
      payments: [pay('ada', { team: 'A' }), pay('seyi', { team: 'A' }), pay('bisi', { team: 'B' }), pay('kemi', { team: 'B' })],
    });

  it('is asked only when teams were set', async () => {
    expect((await setup(four()).service.getBallot('tok')).categories.map((c) => c.key)).toEqual([VoteCategory.POTM, VoteCategory.TEAMMATE]);
    const noTeams = game({ payments: [pay('ada'), pay('bisi')] });
    expect((await setup(noTeams).service.getBallot('tok')).categories.map((c) => c.key)).toEqual([VoteCategory.POTM]);
  });

  it('takes a pick from your own team only', async () => {
    const { service } = setup(four());
    await expect(service.submitVotes('tok', ['ada'], { potm: 'bisi', teammate: 'kemi' })).rejects.toThrow('your own team');
    await expect(service.submitVotes('tok', ['ada'], { potm: 'bisi', teammate: 'seyi' })).resolves.toBeDefined();
  });

  it('shows a winner per team once the vote closes', async () => {
    const votes = [
      { voterId: 'ada', nomineeId: 'seyi', category: VoteCategory.TEAMMATE },
      { voterId: 'bisi', nomineeId: 'kemi', category: VoteCategory.TEAMMATE },
      { voterId: 'kemi', nomineeId: 'bisi', category: VoteCategory.TEAMMATE },
    ];
    const r = await setup(four() as never, { votes }).service.getPublicResults('tok');
    expect(r.categories.filter((c) => c.key === VoteCategory.TEAMMATE).map((c) => c.team)).toEqual(['A', 'B']);
    const closed = await setup({ ...four(), voteOpensAt: new Date(Date.now() - 49 * HOUR) } as never, { votes }).service.getPublicResults('tok');
    const best = closed.categories.filter((c) => c.key === VoteCategory.TEAMMATE);
    expect(best.find((c) => c.team === 'A')!.standings[0].playerId).toBe('seyi');
  });

  it("doesn't move cards or table points", async () => {
    const votes = [
      { voterId: 'ada', nomineeId: 'seyi', category: VoteCategory.TEAMMATE },
      { voterId: 'bisi', nomineeId: 'kemi', category: VoteCategory.TEAMMATE },
    ];
    const { rows } = await setup({ ...four(), voteOpensAt: new Date(Date.now() - 49 * HOUR) } as never, { votes }).service.getGroupTable('grp', 'org');
    for (const r of rows) {
      expect(r.points).toBe(0);
      expect(Object.values(r.attributes).every((a) => a === cardRating(DEFAULT_START))).toBe(true);
    }
  });
});
