import { BIB_COLOURS, TEAM_NAME_MAX as SHARED_MAX } from '@pitchaside/shared';
import { BIB_COLOUR_KEYS, TEAM_NAME_MAX, bibsFor, cleanBibs } from './bibs';

describe('bibs', () => {
  it("offers the same colours and name length as the app's list", () => {
    expect([...BIB_COLOUR_KEYS].sort()).toEqual(Object.keys(BIB_COLOURS).sort());
    expect(TEAM_NAME_MAX).toBe(SHARED_MAX);
  });

  it('keeps colours from the list and tidy names, and drops unknown sides', () => {
    expect(cleanBibs({ A: { colour: 'red', name: '  Red   Devils ' }, B: { colour: 'black', name: '' }, Z: { colour: 'red' } })).toEqual({
      A: { colour: 'red', name: 'Red Devils' },
      B: { colour: 'black' },
    });
  });

  it('cuts long names', () => {
    expect(cleanBibs({ A: { colour: 'red', name: 'x'.repeat(40) } })!.A!.name).toHaveLength(20);
  });

  it('refuses a colour that is not on the list', () => {
    expect(() => cleanBibs({ A: { colour: 'rainbow' } })).toThrow('Pick a colour from the list for team A');
  });

  it('clears to the defaults when empty', () => {
    expect(cleanBibs({})).toBeNull();
    expect(cleanBibs(null)).toBeNull();
  });

  it("uses the game's bibs for the day, else the group's", () => {
    const group = { bibs: { A: { colour: 'red' as const } } };
    expect(bibsFor({ bibs: null, group })).toEqual(group.bibs);
    expect(bibsFor({ bibs: { A: { colour: 'navy' } }, group })).toEqual({ A: { colour: 'navy' } });
    expect(bibsFor({ bibs: null, group: null })).toEqual({});
  });
});
