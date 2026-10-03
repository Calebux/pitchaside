import { MatchClockService } from './match-clock.service';
import { SessionKind, SessionStatus } from './entities/session.entity';

describe('MatchClockService', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-03T19:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  function setup(overrides: Record<string, unknown> = {}) {
    const game: any = {
      id: 's1', kind: SessionKind.GAME, status: SessionStatus.UPCOMING, teamCount: 3,
      clockMinutes: 10, clockEndsAt: null, clockLeftMs: null, clockTeams: null, clockUserId: null, clockUpdatedAt: null,
      payments: [{ playerId: 'p1' }, { playerId: 'p2' }],
      ...overrides,
    };
    const sessionsRepo = { update: jest.fn(), findOne: jest.fn(async () => game) };
    const notifications = { pushToPlayers: jest.fn().mockResolvedValue(2), pushToUser: jest.fn().mockResolvedValue(1) };
    const clock = new MatchClockService(sessionsRepo as any, notifications as any);
    return { clock, game, sessionsRepo, notifications };
  }
  const minutes = (n: number) => n * 60_000;

  it('starts, pauses and resumes from where it stopped', async () => {
    const { clock, game } = setup();
    let st = await clock.act(game, { action: 'start' });
    expect(new Date(st.endsAt!).getTime() - Date.now()).toBe(minutes(10));

    jest.advanceTimersByTime(minutes(3));
    st = await clock.act(game, { action: 'pause' });
    expect(st).toMatchObject({ endsAt: null, leftMs: minutes(7) });

    st = await clock.act(game, { action: 'start' });
    expect(new Date(st.endsAt!).getTime() - Date.now()).toBe(minutes(7));
  });

  it('adds time while running, or changes the length when stopped', async () => {
    const { clock, game } = setup();
    await clock.act(game, { action: 'adjust', delta: 2 });
    expect(game.clockMinutes).toBe(12);
    const st = await clock.act(game, { action: 'start' });
    const end = new Date(st.endsAt!).getTime();
    expect(new Date((await clock.act(game, { action: 'adjust', delta: 1 })).endsAt!).getTime()).toBe(end + minutes(1));
  });

  it('names the two sides on, from the colours in the game', async () => {
    const { clock, game } = setup();
    expect((await clock.act(game, { action: 'teams', teams: ['A', 'C'] })).label).toBe('Orange v Blue');
    // F isn't in a three-side game.
    expect((await clock.act(game, { action: 'teams', teams: ['F', 'B'] })).teams).toEqual(['B']);
  });

  it('pushes full time to the squad and the organiser running it', async () => {
    const { clock, game, notifications } = setup();
    await clock.act(game, { action: 'teams', teams: ['A', 'B'] });
    await clock.act(game, { action: 'start' }, { userId: 'u1' });

    await jest.advanceTimersByTimeAsync(minutes(10));
    expect(notifications.pushToPlayers).toHaveBeenCalledWith(['p1', 'p2'], expect.objectContaining({ body: 'Orange v Yellow — full time.' }));
    expect(notifications.pushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({ kind: 'match_clock' }));
  });

  it('a pause or reset cancels the full-time push', async () => {
    const { clock, game, notifications } = setup();
    await clock.act(game, { action: 'start' });
    jest.advanceTimersByTime(minutes(5));
    await clock.act(game, { action: 'pause' });
    await jest.advanceTimersByTimeAsync(minutes(10));
    expect(notifications.pushToPlayers).not.toHaveBeenCalled();
  });

  it("won't run on a called-off game", async () => {
    const { clock, game } = setup({ status: SessionStatus.CANCELLED });
    await expect(clock.act(game, { action: 'start' })).rejects.toThrow('called off');
  });
});
