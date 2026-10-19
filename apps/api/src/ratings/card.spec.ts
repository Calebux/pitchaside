import { noEvidence, playerCard, type Ability } from './ratings.service';

const skill = (rating: number, games = 10) => ({ rating, games });
/** Nominations (n) against what random picks would give (e), per ability. */
const ev = (over: Partial<Record<Ability, { n: number; e: number }>> = {}) => ({ ...noEvidence(), ...over });

describe('player card', () => {
  it('starts every outfield ability from the skill rating; GK only once nominated in goal', () => {
    const c = playerCard(skill(1700), ev(), 0, 0);
    expect(c.attributes).toEqual({ SHO: 80, PAS: 80, TEC: 80, DEF: 80, IQ: 80, PHY: 80, MOV: 80, GK: null });
    expect(c.ovr).toBe(80);
    expect(playerCard(skill(1700), ev({ GK: { n: 2, e: 1 } }), 0, 0).attributes.GK).not.toBeNull();
  });

  it('never drops a player for not being nominated', () => {
    // Plenty of chances, no nominations: nothing goes below their skill.
    const c = playerCard(skill(1500), ev({ SHO: { n: 0, e: 6 }, PAS: { n: 0, e: 6 } }), 0, 39);
    expect(Math.min(...Object.values(c.attributes).filter((v): v is number => v !== null))).toBe(70);
  });

  it('lifts what teammates keep nominating, and Player of the Match lifts OVR', () => {
    const quiet = playerCard(skill(1500), ev({ SHO: { n: 1, e: 1 } }), 0, 39);
    const star = playerCard(skill(1500), ev({ SHO: { n: 12, e: 1 } }), 15, 39);
    expect(star.attributes.SHO!).toBeGreaterThan(quiet.attributes.SHO!);
    expect(star.ovr!).toBeGreaterThan(quiet.ovr!);
  });

  it('barely moves on a low-turnout week', () => {
    const c = playerCard(skill(1500), ev({ PHY: { n: 1, e: 0.2 } }), 0, 2);
    expect(c.attributes.PHY! - 70).toBeLessThanOrEqual(1);
  });

  it('is provisional until three scored games', () => {
    expect(playerCard(skill(1500, 2), ev(), 0, 0).provisional).toBe(true);
    expect(playerCard(skill(1500, 3), ev(), 0, 0).provisional).toBe(false);
    expect(playerCard(undefined, ev(), 0, 0)).toMatchObject({ provisional: true, skill: 1500, ovr: 70 });
  });
});
