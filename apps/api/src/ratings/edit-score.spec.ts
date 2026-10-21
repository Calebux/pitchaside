import { RatingsService } from './ratings.service';
import { SessionStatus } from '../sessions/entities/session.entity';

/** The organiser corrects a saved game's score; named scorers never outnumber the goals. */
describe("changing a saved game's score", () => {
  function setup(goals: { team: string }[] = [], status = SessionStatus.UPCOMING) {
    const session: any = { id: 's1', status, teamCount: 2, bibs: null, group: { bibs: null }, payments: [] };
    const updates: any[] = [];
    const tx = {
      findOne: async () => ({ id: 'g1', teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1 }),
      find: async () => goals,
      update: async (_e: unknown, _w: unknown, v: unknown) => updates.push(v),
    };
    const gamesRepo = { manager: { transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
    const service = new RatingsService({} as never, gamesRepo as never, {} as never, {} as never, {} as never, {} as never);
    jest.spyOn(service as any, 'loadSession').mockResolvedValue(session);
    jest.spyOn(service, 'getLineup').mockResolvedValue({} as never);
    return { service, updates };
  }

  it('saves the new score', async () => {
    const { service, updates } = setup([{ team: 'A' }]);
    await service.updateGame('s1', 'g1', 'org', { scoreA: 3, scoreB: 0 });
    expect(updates).toEqual([{ scoreA: 3, scoreB: 0 }]);
  });

  it("won't go below the scorers named for a side, and says what to do", async () => {
    const { service, updates } = setup([{ team: 'A' }, { team: 'A' }]);
    await expect(service.updateGame('s1', 'g1', 'org', { scoreA: 1, scoreB: 1 })).rejects.toThrow('Orange has 2 scorers named. Take one off first, then lower the score.');
    expect(updates).toHaveLength(0);
  });

  it('not for a game that was called off', async () => {
    const { service } = setup([], SessionStatus.CANCELLED);
    await expect(service.updateGame('s1', 'g1', 'org', { scoreA: 1, scoreB: 1 })).rejects.toThrow('called off');
  });
});
