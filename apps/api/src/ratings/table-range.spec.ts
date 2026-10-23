import { tableRange } from './ratings.service';

describe('tableRange', () => {
  it('reads the latest N match days and a date range from a link', () => {
    expect(tableRange({ last: '5' })).toEqual({ last: 5 });
    expect(tableRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('leaves out anything odd', () => {
    expect(tableRange({ last: '0' })).toEqual({});
    expect(tableRange({ last: '99' })).toEqual({});
    expect(tableRange({ from: 'yesterday' })).toEqual({});
    // An end before the start isn't a range.
    expect(tableRange({ from: '2026-10-31', to: '2026-10-01' })).toEqual({ from: '2026-10-31' });
  });
});
