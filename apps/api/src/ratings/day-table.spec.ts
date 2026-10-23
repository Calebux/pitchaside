import { dayTable } from './day-table';

const g = (teamA: string, teamB: string, scoreA: number, scoreB: number) => ({ teamA, teamB, scoreA, scoreB });

describe('dayTable', () => {
  it('ranks by points as before', () => {
    const t = dayTable(3, [g('A', 'B', 1, 0), g('A', 'C', 1, 0), g('B', 'C', 0, 0)]);
    expect(t.rows.map((r) => r.team)).toEqual(['A', 'B', 'C']);
    expect(t.teamOfTheDay).toBe('A');
  });

  it('winner stays: points per game beats a side that simply played more', () => {
    // A won 3 of 5 (9 pts, 1.8 a game); B won both of 2 (6 pts, 3 a game).
    const games = [g('A', 'C', 1, 0), g('A', 'D', 1, 0), g('A', 'C', 0, 1), g('A', 'D', 1, 0), g('A', 'C', 0, 2), g('B', 'D', 2, 0), g('B', 'C', 2, 1)];
    const byPoints = dayTable(4, games);
    const byGame = dayTable(4, games, true);
    expect(byPoints.rows[0].team).toBe('A');
    expect(byGame.rows[0].team).toBe('B');
    expect(byGame.rows[0].ppg).toBe(3);
    expect(byGame.teamOfTheDay).toBe('B');
  });

  it('winner stays: a side yet to play is last, not top on 0 a game', () => {
    const t = dayTable(4, [g('A', 'B', 0, 1)], true);
    expect(t.rows[0].team).toBe('B');
    expect(t.rows.slice(-2).map((r) => r.p)).toEqual([0, 0]);
  });

  it('no Team of the Day when level', () => {
    expect(dayTable(2, [g('A', 'B', 1, 1)], true).teamOfTheDay).toBeNull();
    expect(dayTable(2, []).teamOfTheDay).toBeNull();
  });
});
