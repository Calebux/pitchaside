import { owedSplit } from './credit';

const due = (id: string, date: string, amount = 1500) => ({ id, amount: amount.toFixed(2), session: { date } });

describe('owedSplit (what a member owes now, and later)', () => {
  const today = '2026-10-20';

  it('counts played games and the one next game as now, games further ahead as later', () => {
    const r = owedSplit([due('a', '2026-10-17'), due('b', '2026-10-24'), due('c', '2026-10-31')], 0, today);
    expect(r.now.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.later.map((p) => p.id)).toEqual(['c']);
    expect(r).toMatchObject({ nowTotal: 3000, laterTotal: 1500 });
  });

  it("counts today's game as now", () => {
    expect(owedSplit([due('a', today), due('b', '2026-10-27')], 0, today).now.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('takes a part payment off the oldest due', () => {
    const r = owedSplit([due('a', '2026-10-17'), due('b', '2026-10-24')], 1000, today);
    expect(r.now[0]).toMatchObject({ left: 500, paidSoFar: 1000 });
    expect(r.now[1]).toMatchObject({ left: 1500, paidSoFar: 0 });
    expect(r.nowTotal).toBe(2000);
  });

  it('owes nothing with no dues', () => {
    expect(owedSplit([], 500, today)).toMatchObject({ now: [], later: [], nowTotal: 0, laterTotal: 0 });
  });
});
