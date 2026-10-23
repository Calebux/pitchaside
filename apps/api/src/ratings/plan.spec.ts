import { cleanPlan, withAway, withKeepers } from './plan';

const ID = '7f0b1c9e-2a3d-4e5f-8a9b-0c1d2e3f4a5b';

describe('cleanPlan', () => {
  it('keeps a usual day', () => {
    expect(cleanPlan({ pitchMinutes: 120, gameMinutes: 15, onPitch: 6, swapMinutes: 5 })).toEqual({
      pitchMinutes: 120,
      gameMinutes: 15,
      onPitch: 6,
      swapMinutes: 5,
    });
  });

  it('takes no swaps', () => {
    expect(cleanPlan({ pitchMinutes: 60, gameMinutes: 7, onPitch: 5 }).swapMinutes).toBe(0);
  });

  it('refuses minutes out of range or not whole', () => {
    expect(() => cleanPlan({ pitchMinutes: 5, gameMinutes: 5, onPitch: 5 })).toThrow('The booking');
    expect(() => cleanPlan({ pitchMinutes: 600, gameMinutes: 5, onPitch: 5 })).toThrow('The booking');
    expect(() => cleanPlan({ pitchMinutes: 60, gameMinutes: 7.5, onPitch: 5 })).toThrow('A game');
    expect(() => cleanPlan({ pitchMinutes: 60, gameMinutes: 7, onPitch: 30 })).toThrow('Players on the pitch');
    expect(() => cleanPlan({ pitchMinutes: 30, gameMinutes: 40, onPitch: 5 })).toThrow('longer than the booking');
    expect(() => cleanPlan(null)).toThrow('missing');
  });

  it('keeps who left early by player id only', () => {
    expect(cleanPlan({ pitchMinutes: 120, gameMinutes: 15, onPitch: 6, away: { [ID]: 60 } }).away).toEqual({ [ID]: 60 });
    expect(() => cleanPlan({ pitchMinutes: 120, gameMinutes: 15, onPitch: 6, away: { nope: 60 } })).toThrow();
    expect(() => cleanPlan({ pitchMinutes: 120, gameMinutes: 15, onPitch: 6, away: { [ID]: 500 } })).toThrow('When they left');
  });

  it('drops extra fields', () => {
    expect(cleanPlan({ pitchMinutes: 60, gameMinutes: 7, onPitch: 5, swapMinutes: 0, sneaky: 1 })).not.toHaveProperty('sneaky');
  });
});

describe('withAway', () => {
  const plan = cleanPlan({ pitchMinutes: 120, gameMinutes: 15, onPitch: 6, swapMinutes: 5 });

  it('marks someone gone and back', () => {
    const gone = withAway(plan, ID, 45);
    expect(gone.away).toEqual({ [ID]: 45 });
    expect(withAway(gone, ID, null)).not.toHaveProperty('away');
  });

  it('refuses a time after the booking', () => {
    expect(() => withAway(plan, ID, 200)).toThrow('When they left');
  });
});

describe('withKeepers', () => {
  it('keeps only real choices', () => {
    const plan = cleanPlan({ pitchMinutes: 120, gameMinutes: 15, onPitch: 6, swapMinutes: 5 });
    expect(withKeepers(plan, [{ id: 'a', keeper: 'happy' }, { id: 'b', keeper: null }, { id: 'c', keeper: 'rather_not' }, { id: 'd' }]).keepers).toEqual({
      a: 'happy',
      c: 'rather_not',
    });
  });

  it('never stores keepers sent by a phone', () => {
    expect(cleanPlan({ pitchMinutes: 60, gameMinutes: 7, onPitch: 5, keepers: { a: 'happy' } })).not.toHaveProperty('keepers');
  });
});

describe('cleanPlan: winner stays', () => {
  const base = { pitchMinutes: 120, gameMinutes: 10, onPitch: 6, swapMinutes: 5 };

  it('fills in the usual rules', () => {
    expect(cleanPlan({ ...base, format: 'winner_stays' })).toMatchObject({ format: 'winner_stays', firstMinutes: 10, firstTo: 2, twoAndOff: true });
  });

  it('keeps the organiser’s choices', () => {
    expect(cleanPlan({ ...base, format: 'winner_stays', firstMinutes: 8, firstTo: 3, twoAndOff: false })).toMatchObject({ firstMinutes: 8, firstTo: 3, twoAndOff: false });
  });

  it('refuses odd values and unknown formats', () => {
    expect(() => cleanPlan({ ...base, format: 'winner_stays', firstTo: 9 })).toThrow('Goals to go off');
    expect(() => cleanPlan({ ...base, format: 'knockout' })).toThrow('Pick how you play');
  });

  it('a schedule plan carries no winner-stays fields', () => {
    expect(cleanPlan({ ...base, format: 'schedule', firstTo: 2 })).not.toHaveProperty('firstTo');
  });
});

describe('cleanPlan: the shuffle draw', () => {
  const day = { pitchMinutes: 60, gameMinutes: 10, onPitch: 5, swapMinutes: 5 };
  it('keeps a whole-number draw, and none when not sent', () => {
    expect(cleanPlan({ ...day, draw: 12345 }).draw).toBe(12345);
    expect(cleanPlan(day).draw).toBeUndefined();
    expect(cleanPlan({ ...day, draw: null }).draw).toBeUndefined();
  });
  it('refuses a draw that is not a whole number in range', () => {
    for (const draw of [0, -1, 1.5, 'abc', 2_147_483_648]) expect(() => cleanPlan({ ...day, draw })).toThrow('The shuffle');
  });
});
