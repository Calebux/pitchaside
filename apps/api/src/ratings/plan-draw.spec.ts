import { BadRequestException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { SessionKind, SessionStatus } from '../sessions/entities/session.entity';

/** Shuffling the plan: allowed until the first game starts, and a re-save keeps the draw. */
describe('RatingsService.setPlan and the draw', () => {
  const base = { pitchMinutes: 60, gameMinutes: 10, onPitch: 5, swapMinutes: 5 };
  function setup(over: { draw?: number; scores?: boolean; timerStartedAt?: Date | null } = {}) {
    const session: any = {
      id: 's1',
      kind: SessionKind.GAME,
      status: SessionStatus.UPCOMING,
      plan: { ...base, ...(over.draw ? { draw: over.draw } : {}) },
      timerStartedAt: over.timerStartedAt ?? null,
      timerMinutes: 10,
    };
    const svc: any = Object.create(RatingsService.prototype);
    const update = jest.fn().mockResolvedValue(undefined);
    svc.sessionsRepo = { update };
    jest.spyOn(svc, 'loadSession').mockResolvedValue(session);
    jest.spyOn(svc, 'scoresIn').mockResolvedValue(!!over.scores);
    jest.spyOn(svc, 'getLineup').mockResolvedValue({});
    const saved = () => update.mock.calls.at(-1)?.[1].plan;
    return { svc: svc as RatingsService, saved };
  }

  it('saves a new draw before the day starts', async () => {
    const { svc, saved } = setup({ draw: 5 });
    await svc.setPlan('s1', 'org', { ...base, draw: 99 });
    expect(saved().draw).toBe(99);
  });

  it('keeps the draw when the plan is saved again without one (changing the minutes)', async () => {
    const { svc, saved } = setup({ draw: 5, scores: true });
    await svc.setPlan('s1', 'org', { ...base, swapMinutes: 4 });
    expect(saved()).toEqual(expect.objectContaining({ swapMinutes: 4, draw: 5 }));
  });

  it('undo back to no draw clears it', async () => {
    const { svc, saved } = setup({ draw: 5 });
    await svc.setPlan('s1', 'org', { ...base, draw: null });
    expect(saved().draw).toBeUndefined();
  });

  it('refuses a new draw once a game is saved', async () => {
    const { svc } = setup({ draw: 5, scores: true });
    await expect(svc.setPlan('s1', 'org', { ...base, draw: 6 })).rejects.toThrow(new BadRequestException('The first game has started, so the order can’t be shuffled now'));
  });

  it('refuses a new draw while the first game’s clock is running', async () => {
    const { svc } = setup({ draw: 5, timerStartedAt: new Date(Date.now() - 60_000) });
    await expect(svc.setPlan('s1', 'org', { ...base, draw: 6 })).rejects.toThrow('can’t be shuffled now');
  });

  it('the same draw sent again after the start is fine', async () => {
    const { svc, saved } = setup({ draw: 5, scores: true });
    await svc.setPlan('s1', 'org', { ...base, draw: 5, onPitch: 6 });
    expect(saved()).toEqual(expect.objectContaining({ onPitch: 6, draw: 5 }));
  });
});
