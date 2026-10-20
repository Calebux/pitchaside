import { DEFAULT_GAME_MINUTES, timerChange, timerOf } from './timer';

describe('game timer', () => {
  it("uses the day's length, else the group's, else 7 minutes", () => {
    expect(timerOf({ timerMinutes: 10, group: { gameMinutes: 8 } }).minutes).toBe(10);
    expect(timerOf({ timerMinutes: null, group: { gameMinutes: 8 } }).minutes).toBe(8);
    expect(timerOf({ group: { gameMinutes: null } }).minutes).toBe(DEFAULT_GAME_MINUTES);
  });

  it('says when the clock started, or null when it is not running', () => {
    const at = new Date('2026-10-24T08:05:00Z');
    expect(timerOf({ timerStartedAt: at }).startedAt).toBe('2026-10-24T08:05:00.000Z');
    expect(timerOf({ timerStartedAt: null }).startedAt).toBeNull();
  });

  it('starts from now (also over a running clock), stops, and sets a length', () => {
    const now = new Date('2026-10-24T08:00:00Z');
    expect(timerChange({ start: true }, now)).toEqual({ timerStartedAt: now });
    expect(timerChange({ start: false }, now)).toEqual({ timerStartedAt: null });
    expect(timerChange({ minutes: 9.6 }, now)).toEqual({ timerMinutes: 10 });
    expect(timerChange({}, now)).toEqual({});
  });

  it('turns down a length outside 1 to 60 minutes', () => {
    expect(() => timerChange({ minutes: 0 })).toThrow('A game lasts 1 to 60 minutes');
    expect(() => timerChange({ minutes: 70 })).toThrow('A game lasts 1 to 60 minutes');
  });
});
