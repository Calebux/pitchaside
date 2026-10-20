import { RatingsService } from './ratings.service';
import { SessionStatus } from '../sessions/entities/session.entity';

const today = new Date().toISOString().slice(0, 10);
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
  const tx = { save: async (x: any) => (Array.isArray(x) ? savedGoals.push(...x) : Object.assign(x, { id: 'g1' })) };
  const gamesRepo = {
    create: (g: unknown) => g,
    findOne: async () => ({ id: 'g1', sessionId: 's1', teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1 }),
    manager: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  };
  const goalsRepo = { create: (g: unknown) => g, find: async () => existing, save: async (g: any) => savedGoals.push(g) };
  const service = new RatingsService({} as never, gamesRepo as never, goalsRepo as never, {} as never, {} as never, { find: async () => [] } as never);
  jest.spyOn(service as any, 'loadSession').mockResolvedValue(session);
  jest.spyOn(service, 'getLineup').mockResolvedValue({} as never);
  return { service, savedGoals };
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
});

describe("captains keeping the score", () => {
  function captainSetup(over: { date?: string; captain?: boolean; recordedBy?: string } = {}) {
    const session: any = {
      id: 's1',
      kind: 'game',
      date: over.date ?? today,
      status: SessionStatus.UPCOMING,
      teamCount: 2,
      group: { organizationId: 'org' },
      payments: [
        { playerId: 'ada', team: 'A', captain: over.captain ?? true, attendance: null, player: { firstName: 'Ada', lastName: 'Obi', nickname: null } },
        { playerId: 'bisi', team: 'B', captain: false, attendance: null, player: { firstName: 'Bisi', lastName: 'Lawal', nickname: null } },
      ],
    };
    const sessionsRepo = { findOne: async () => session };
    const gamesRepo = { findOne: async () => ({ id: 'g1', recordedBy: over.recordedBy ?? 'Tunde (organiser)' }) };
    const goalsRepo = { findOne: async () => ({ id: 'x1', recordedBy: over.recordedBy ?? 'Tunde (organiser)' }) };
    const service = new RatingsService({} as never, gamesRepo as never, goalsRepo as never, sessionsRepo as never, {} as never, { find: async () => [] } as never);
    const addGame = jest.spyOn(service, 'addGame').mockResolvedValue({ squad: [] } as never);
    const deleteGame = jest.spyOn(service, 'deleteGame').mockResolvedValue({ squad: [] } as never);
    return { service, addGame, deleteGame };
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

  it("can't delete what the organiser saved, but can delete a captain's", async () => {
    const organiser = captainSetup();
    await expect(organiser.service.captainDeleteGame('s1', 'g1', ['ada'])).rejects.toThrow('only they can delete it');
    await expect(organiser.service.captainDeleteGoal('s1', 'x1', ['ada'])).rejects.toThrow('only they can remove it');
    const captain = captainSetup({ recordedBy: 'Bisi (captain)' });
    await captain.service.captainDeleteGame('s1', 'g1', ['ada']);
    expect(captain.deleteGame).toHaveBeenCalledWith('s1', 'g1', 'org');
  });
});
