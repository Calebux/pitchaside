/** A game as the day's table needs it. */
export interface TableGame {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
}

const SIDES = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Per-side table for one match day: 3 for a win, 1 for a draw. With `perGame` (winner stays, where
 * sides play different numbers of games) it's ranked by points per game played, then goal
 * difference per game; a side yet to play sits at the bottom.
 */
export function dayTable(teamCount: number, games: TableGame[], perGame = false) {
  const rows = SIDES.slice(0, teamCount).map((team) => ({ team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, ppg: 0 }));
  const by = new Map(rows.map((r) => [r.team, r]));
  for (const g of games) {
    const a = by.get(g.teamA);
    const b = by.get(g.teamB);
    if (!a || !b) continue;
    a.p++; b.p++;
    a.gf += g.scoreA; a.ga += g.scoreB;
    b.gf += g.scoreB; b.ga += g.scoreA;
    if (g.scoreA > g.scoreB) { a.w++; b.l++; a.pts += 3; }
    else if (g.scoreA < g.scoreB) { b.w++; a.l++; b.pts += 3; }
    else { a.d++; b.d++; a.pts++; b.pts++; }
  }
  for (const r of rows) r.ppg = r.p ? Math.round((r.pts / r.p) * 100) / 100 : 0;
  const gdpg = (r: (typeof rows)[number]) => (r.p ? (r.gf - r.ga) / r.p : 0);
  if (perGame) {
    rows.sort((x, y) => Number(y.p > 0) - Number(x.p > 0) || y.ppg - x.ppg || gdpg(y) - gdpg(x) || y.pts - x.pts || x.team.localeCompare(y.team));
  } else {
    rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.localeCompare(y.team));
  }
  const [top, next] = rows;
  // Team of the Day only once games are played and there's a clear leader.
  const ahead = perGame
    ? !next || next.p === 0 || next.ppg < top.ppg || gdpg(next) < gdpg(top)
    : !next || next.pts < top.pts || next.gf - next.ga < top.gf - top.ga;
  const teamOfTheDay = top && top.p > 0 && ahead ? top.team : null;
  return { rows, teamOfTheDay, perGame };
}
