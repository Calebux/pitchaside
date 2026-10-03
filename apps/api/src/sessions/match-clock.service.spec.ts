import { MatchClockService } from './match-clock.service';

describe('MatchClockService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup() {
    const notifications = { pushToUser: jest.fn().mockResolvedValue(1) };
    return { clock: new MatchClockService(notifications as any), notifications };
  }

  it("pushes to the organiser's devices when the set ends", () => {
    const { clock, notifications } = setup();
    expect(clock.start('s1', 'u1', new Date(Date.now() + 10 * 60_000), 'Orange v Yellow')).toEqual({ scheduled: true });

    jest.advanceTimersByTime(10 * 60_000 - 1);
    expect(notifications.pushToUser).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(notifications.pushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({ kind: 'match_clock', body: expect.stringContaining('Orange v Yellow') }));
  });

  it('stopping (pause or reset) cancels the push, and restarting replaces it', () => {
    const { clock, notifications } = setup();
    clock.start('s1', 'u1', new Date(Date.now() + 60_000), 'Set');
    clock.start('s1', 'u1', new Date(Date.now() + 120_000), 'Set');
    jest.advanceTimersByTime(60_000);
    expect(notifications.pushToUser).not.toHaveBeenCalled();
    clock.stop('s1', 'u1');
    jest.advanceTimersByTime(120_000);
    expect(notifications.pushToUser).not.toHaveBeenCalled();
  });

  it('ignores an end time in the past or hours away', () => {
    const { clock } = setup();
    expect(clock.start('s1', 'u1', new Date(Date.now() - 1000), 'Set')).toEqual({ scheduled: false });
    expect(clock.start('s1', 'u1', new Date(Date.now() + 5 * 3600_000), 'Set')).toEqual({ scheduled: false });
  });
});
