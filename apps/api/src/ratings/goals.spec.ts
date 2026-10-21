import { localDate } from '../common/time.util';
import { RatingsService } from './ratings.service';
import { SessionStatus } from '../sessions/entities/session.entity';

// Match day in the app's own time zone (Lagos), as the service checks it: a UTC date is a day
// behind for an hour every night.
const today = localDate(0);
const pay = (playerId: string, team: string | null, attendance: string | null = null) => ({ playerId, team, attendance, captain: false });

/** A match-day game with Ada and Chidi on Orange (A), Bisi and Dayo on Yellow (B). */
function setup(existing: { team: string }[] = []) {
  const session: any = {
    id: 's1',
    date: today,
    status: SessionStatus.UPCOMING,
    teamCount: 2,
    payments: [pay('ada', 'A'), pay('chidi', 'A'), pay('bisi', 'B'), pay('dayo', 'B'), pay('lanre', 'A', 'no_show')],
  };
  const savedGoals: any[] = [];
  const savedGames: any[] = [];
  const theGame = { id: 'g1', sessionId: 's1', teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1 };
  const tx = {
    save: async (x: any) => (Array.isArray(x) ? savedGoals.push(...x) : x.scorerId ? savedGoals.push(x) : (savedGames.push(x), Object.assign(x, { id: 'g1' }))),
    findOne: async () => theGame,
    find: async () => existing,
  };
  const keys = new Set<string>();
  const gamesRepo = {
    create: (g: unknown) => g,
    findOne: async () => theGame,
    exists: async ({ where }: any) => keys.has(where.clientKey),
    manager: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  };
  const goalsRepo = { create: (g: unknown) => g, find: async () => existing, save: async (g: any) => savedGoals.push(g), exists: async ({ where }: any) => keys.has(where.clientKey) };
  const service = new RatingsService({} as never, gamesRepo as never, goalsRepo as never, {} as never, {} as never, { find: async () => [] } as never);
  jest.spyOn(service as any, 'loadSession').mockResolvedValue(session);
  jest.spyOn(service, 'getLineup').mockResolvedValue({} as never);
  return { service, savedGoals, savedGames, keys };
}

const game = (goals: any[]) => ({ teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1, goals });

describe('goals and assists', () => {
  it('saves the goals with the game, with who recorded them', async () => {
    const { service, savedGoals } = setup();
    await service.addGame('s1', 'org', game([{ team: 'A', scorerId: 'ada', assistId: 'chidi' }, { team: 'B', scorerId: 'bisi' }]), 'Tunde (organiser)');
    expect(savedGoals).toEqual([
      expect.objectContaining({ team: 'A', scorerId: 'ada', assistId: 'chidi', gameId: 'g1', recordedBy: 'Tunde (organiser)' }),
      expect.objectContaining({ team: 'B', scorerId: 'bisi', assistId: null }),
    ]);
  });

  it('refuses a scorer who is on the other team', async () => {
    const { service } = setup();
    await expect(service.addGame('s1', 'org', game([{ team: 'A', scorerId: 'bisi' }]))).rejects.toThrow("The scorer isn't on that team");
  });

  it('refuses an assist from the other team, or from the scorer', async () => {
    const { service } = setup();
    await expect(service.addGame('s1', 'org', game([{ team: 'A', scorerId: 'ada', assistId: 'dayo' }]))).rejects.toThrow('teammate');
    await expect(service.addGame('s1', 'org', game([{ team: 'A', scorerId: 'ada', assistId: 'ada' }]))).rejects.toThrow('teammate');
  });

  it("refuses a player who didn't come", async () => {
    const { service } = setup();
    await expect(service.addGame('s1', 'org', game([{ team: 'A', scorerId: 'lanre' }]))).rejects.toThrow("The scorer isn't on that team");
  });

  it('refuses more named scorers than goals', async () => {
    const { service } = setup();
    await expect(service.addGame('s1', 'org', game([{ team: 'B', scorerId: 'bisi' }, { team: 'B', scorerId: 'dayo' }]))).rejects.toThrow('More scorers than goals');
  });

  it('adds a scorer to a saved game only while its goals are not all named', async () => {
    const full = setup([{ team: 'B' }]);
    await expect(full.service.addGoal('s1', 'g1', 'org', { team: 'B', scorerId: 'dayo' })).rejects.toThrow('More scorers than goals');
    const open = setup([{ team: 'A' }]);
    await open.service.addGoal('s1', 'g1', 'org', { team: 'A', scorerId: 'chidi' }, 'Tunde (organiser)');
    expect(open.savedGoals[0]).toMatchObject({ scorerId: 'chidi', gameId: 'g1', sessionId: 's1' });
  });

  it('saves a retried tap once: the same key again is already done', async () => {
    const { service, savedGames, savedGoals, keys } = setup();
    await service.addGame('s1', 'org', { ...game([]), clientKey: 'k1' });
    expect(savedGames).toHaveLength(1);
    keys.add('k1');
    await service.addGame('s1', 'org', { ...game([]), clientKey: 'k1' });
    expect(savedGames).toHaveLength(1);
    keys.add('k2');
    await service.addGoal('s1', 'g1', 'org', { team: 'A', scorerId: 'ada', clientKey: 'k2' });
    expect(savedGoals).toHaveLength(0);
  });

  it('counts a racing copy of the same tap as done when the database turns it away', async () => {
    const { service, savedGames } = setup();
    jest.spyOn((service as any).gamesRepo.manager, 'transaction').mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    await expect(service.addGame('s1', 'org', { ...game([]), clientKey: 'k1' })).resolves.toBeDefined();
    expect(savedGames).toHaveLength(0);
  });
});

describe("captains keeping the score", () => {
  function captainSetup(
    over: { date?: string; captain?: boolean; vice?: boolean; recordedBy?: string; status?: SessionStatus; attendance?: string | null; teamCount?: number; gameTeams?: [string, string]; goalsBy?: string[] } = {},
  ) {
    const session: any = {
      id: 's1',
      kind: 'game',
      date: over.date ?? today,
      status: over.status ?? SessionStatus.UPCOMING,
      teamCount: over.teamCount ?? 2,
      group: { organizationId: 'org' },
      payments: [
        { playerId: 'ada', team: 'A', captain: over.captain ?? true, viceCaptain: over.vice ?? false, attendance: over.attendance ?? null, player: { firstName: 'Ada', lastName: 'Obi', nickname: null } },
        { playerId: 'chidi', team: 'A', captain: false, attendance: null, player: { firstName: 'Chidi', lastName: 'Nwosu', nickname: null } },
        { playerId: 'bisi', team: 'B', captain: false, attendance: null, player: { firstName: 'Bisi', lastName: 'Lawal', nickname: null } },
      ],
    };
    const [teamA, teamB] = over.gameTeams ?? ['A', 'B'];
    const sessionsRepo = { findOne: async () => session };
    const gamesRepo = { findOne: async () => ({ id: 'g1', teamA, teamB, recordedBy: over.recordedBy ?? 'Tunde (organiser)' }) };
    const goalsRepo = {
      findOne: async () => ({ id: 'x1', recordedBy: over.recordedBy ?? 'Tunde (organiser)' }),
      find: async () => (over.goalsBy ?? []).map((recordedBy) => ({ recordedBy })),
    };
    const eventsRepo = { findOne: async () => ({ id: 'e1', recordedBy: over.recordedBy ?? 'Tunde (organiser)' }) };
    const service = new RatingsService({} as never, gamesRepo as never, goalsRepo as never, sessionsRepo as never, {} as never, eventsRepo as never);
    const addGame = jest.spyOn(service, 'addGame').mockResolvedValue({ squad: [] } as never);
    const addGoal = jest.spyOn(service, 'addGoal').mockResolvedValue({ squad: [] } as never);
    const addEvent = jest.spyOn(service, 'addEvent').mockResolvedValue({ squad: [] } as never);
    const deleteGame = jest.spyOn(service, 'deleteGame').mockResolvedValue({ squad: [] } as never);
    const deleteEvent = jest.spyOn(service, 'deleteEvent').mockResolvedValue({ squad: [] } as never);
    return { service, addGame, addGoal, addEvent, deleteGame, deleteEvent };
  }
  const input = { teamA: 'A', teamB: 'B', scoreA: 1, scoreB: 0 };

  it("signs a captain's score with their name", async () => {
    const { service, addGame } = captainSetup();
    await service.captainAddGame('s1', ['ada'], input);
    expect(addGame).toHaveBeenCalledWith('s1', 'org', input, 'Ada (captain)');
  });

  it('only lets captains keep the score', async () => {
    const { service } = captainSetup({ captain: false });
    await expect(service.captainAddGame('s1', ['ada'], input)).rejects.toThrow('Only the captains');
  });

  it('only on match day', async () => {
    const { service } = captainSetup({ date: '2020-01-01' });
    await expect(service.captainAddGame('s1', ['ada'], input)).rejects.toThrow('match day only');
  });

  it("can delete only what they saved themselves: not the organiser's, not the other captain's", async () => {
    const organiser = captainSetup();
    await expect(organiser.service.captainDeleteGame('s1', 'g1', ['ada'])).rejects.toThrow('only they can delete it');
    await expect(organiser.service.captainDeleteGoal('s1', 'x1', ['ada'])).rejects.toThrow('only they can remove it');
    const other = captainSetup({ recordedBy: 'Bisi (captain)' });
    await expect(other.service.captainDeleteGame('s1', 'g1', ['ada'])).rejects.toThrow('Bisi (captain) saved this score: ask them or the organiser');
    await expect(other.service.captainDeleteEvent('s1', 'e1', ['ada'])).rejects.toThrow('ask them or the organiser');
    const own = captainSetup({ recordedBy: 'Ada (captain)' });
    await own.service.captainDeleteGame('s1', 'g1', ['ada']);
    expect(own.deleteGame).toHaveBeenCalledWith('s1', 'g1', 'org');
  });

  it("won't delete their game once the organiser has named scorers in it", async () => {
    const { service, deleteGame } = captainSetup({ recordedBy: 'Ada (captain)', goalsBy: ['Ada (captain)', 'Tunde (organiser)'] });
    await expect(service.captainDeleteGame('s1', 'g1', ['ada'])).rejects.toThrow('Someone else named scorers');
    expect(deleteGame).not.toHaveBeenCalled();
  });

  it('only adds games their own team played', async () => {
    const { service, addGame } = captainSetup({ teamCount: 3 });
    await expect(service.captainAddGame('s1', ['ada'], { teamA: 'B', teamB: 'C', scoreA: 1, scoreB: 0 })).rejects.toThrow('games your team played');
    expect(addGame).not.toHaveBeenCalled();
  });

  it('only names scorers in games their own team played', async () => {
    const { service, addGoal } = captainSetup({ teamCount: 3, gameTeams: ['B', 'C'] });
    await expect(service.captainAddGoal('s1', 'g1', ['ada'], { team: 'B', scorerId: 'bisi' })).rejects.toThrow('games your team played');
    expect(addGoal).not.toHaveBeenCalled();
  });

  it("adds cards and saves for their own players, never the other side's", async () => {
    const { service, addEvent } = captainSetup();
    await expect(service.captainAddEvent('s1', ['ada'], { playerId: 'bisi', kind: 'yellow' })).rejects.toThrow('your own team only');
    await service.captainAddEvent('s1', ['ada'], { playerId: 'chidi', kind: 'save' });
    expect(addEvent).toHaveBeenCalledTimes(1);
    expect(addEvent).toHaveBeenCalledWith('s1', 'org', { playerId: 'chidi', kind: 'save' }, 'Ada (captain)');
  });

  it('stops at full time: the organiser changes scores while the vote is on', async () => {
    const { service } = captainSetup({ status: SessionStatus.COMPLETED });
    await expect(service.captainAddGame('s1', ['ada'], input)).rejects.toThrow('Full time');
  });

  it('lets a vice-captain keep the score too, signed as vice-captain', async () => {
    const { service, addGame } = captainSetup({ captain: false, vice: true });
    await service.captainAddGame('s1', ['ada'], input);
    expect(addGame).toHaveBeenCalledWith('s1', 'org', input, 'Ada (vice-captain)');
  });

  it("a vice-captain's own score is theirs to delete; the captain's isn't", async () => {
    const own = captainSetup({ captain: false, vice: true, recordedBy: 'Ada (vice-captain)' });
    await own.service.captainDeleteGame('s1', 'g1', ['ada']);
    expect(own.deleteGame).toHaveBeenCalledWith('s1', 'g1', 'org');
    const captains = captainSetup({ captain: false, vice: true, recordedBy: 'Chidi (captain)' });
    await expect(captains.service.captainDeleteGame('s1', 'g1', ['ada'])).rejects.toThrow('Chidi (captain) saved this score: ask them or the organiser');
  });

  it("can't keep the score when marked as not here", async () => {
    const { service } = captainSetup({ attendance: 'no_show' });
    await expect(service.captainAddGame('s1', ['ada'], input)).rejects.toThrow('not here today');
  });
});

describe('naming captains and vice-captains', () => {
  function lineupSetup(status = SessionStatus.UPCOMING) {
    const payments: any[] = [
      { playerId: 'ada', team: 'A', captain: true, viceCaptain: false, player: { firstName: 'Ada', lastName: 'Obi' } },
      { playerId: 'chidi', team: 'A', captain: false, viceCaptain: false, player: { firstName: 'Chidi', lastName: 'Nwosu' } },
      { playerId: 'bisi', team: null, captain: false, viceCaptain: false, player: { firstName: 'Bisi', lastName: 'Lawal' } },
    ];
    const session: any = { id: 's1', kind: 'game', date: today, status, teamCount: 2, group: { name: 'Saturday Ballers', bibs: null }, payments };
    const save = jest.fn(async (x: unknown) => x);
    const sessionsRepo = { manager: { save }, update: jest.fn() };
    const gamesRepo = { count: async () => 0 };
    const notifyPlayers = jest.fn(async () => ({ delivered: 1, missed: 0 }));
    const notifications = { later: (fn: () => Promise<unknown>) => void fn(), notifyPlayers };
    const service = new RatingsService({} as never, gamesRepo as never, {} as never, sessionsRepo as never, {} as never, {} as never, notifications as never);
    jest.spyOn(service as any, 'loadSession').mockResolvedValue(session);
    jest.spyOn(service as any, 'scoresIn').mockResolvedValue(false);
    jest.spyOn(service, 'getLineup').mockResolvedValue({} as never);
    return { service, payments, notifyPlayers };
  }

  it('names a vice-captain, puts them on the side and tells them', async () => {
    const { service, payments, notifyPlayers } = lineupSetup();
    await service.setLineup('s1', 'org', { vices: { B: 'bisi' } });
    expect(payments[2]).toMatchObject({ team: 'B', viceCaptain: true, captain: false });
    expect(notifyPlayers).toHaveBeenCalledWith(['bisi'], expect.objectContaining({ title: "You're vice-captain of Yellow ⚽", url: '/me/games/s1' }));
  });

  it('one vice per side, and nobody is both captain and vice', async () => {
    const { service, payments } = lineupSetup();
    await service.setLineup('s1', 'org', { vices: { A: 'chidi' } });
    await service.setLineup('s1', 'org', { vices: { A: 'ada' } });
    expect(payments[1].viceCaptain).toBe(false);
    expect(payments[0]).toMatchObject({ viceCaptain: true, captain: false });
  });

  it('tells a new captain, not one who already had the armband', async () => {
    const { service, notifyPlayers } = lineupSetup();
    await service.setLineup('s1', 'org', { captains: { A: 'ada' } });
    expect(notifyPlayers).not.toHaveBeenCalled();
    await service.setLineup('s1', 'org', { captains: { A: 'chidi' } });
    expect(notifyPlayers).toHaveBeenCalledWith(['chidi'], expect.objectContaining({ title: "You're captain of Orange ⚽" }));
  });

  it('no message for a game that has already ended', async () => {
    const { service, notifyPlayers } = lineupSetup(SessionStatus.COMPLETED);
    await service.setLineup('s1', 'org', { captains: { B: 'bisi' } });
    expect(notifyPlayers).not.toHaveBeenCalled();
  });

  it('moving a vice-captain to another side takes the armband off', async () => {
    const { service, payments } = lineupSetup();
    await service.setLineup('s1', 'org', { vices: { A: 'chidi' } });
    await service.setLineup('s1', 'org', { teams: { chidi: 'B' } });
    expect(payments[1]).toMatchObject({ team: 'B', viceCaptain: false });
  });
});
