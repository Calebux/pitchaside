'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ratings';
import { FilterBar, FilterMenu } from '@/components/filter-menu';
import { stagger } from '@/components/motion';
import { getGroupTable, getRatingTrial, type LeagueTable, type RatingTrial } from '@/lib/api';

type Row = LeagueTable['rows'][number];
export type StatSort = 'rating' | 'goals' | 'assists' | 'contrib' | 'potm' | 'vii' | 'wins' | 'bestOnTeam' | 'teamOfDay' | 'games';

/** Every number the list can rank by: its name, the short label beside the value, and how to read it. */
const STATS: { key: StatSort; label: string; unit: string; of: (r: Row) => number; perGame: boolean }[] = [
  { key: 'rating', label: 'Rating', unit: 'rating', of: (r) => r.ovr ?? 0, perGame: false },
  { key: 'goals', label: 'Goals', unit: 'goals', of: (r) => r.goals, perGame: true },
  { key: 'assists', label: 'Assists', unit: 'assists', of: (r) => r.assists, perGame: true },
  { key: 'contrib', label: 'Goals + assists', unit: 'G+A', of: (r) => r.goals + r.assists, perGame: true },
  { key: 'potm', label: 'Player of the Match', unit: 'POTM', of: (r) => r.potmWins, perGame: true },
  { key: 'vii', label: 'Best VII of the Day', unit: 'Best VII', of: (r) => r.viiOfDay, perGame: true },
  { key: 'wins', label: 'Games won', unit: 'won', of: (r) => r.record.w, perGame: true },
  { key: 'bestOnTeam', label: 'Best on their team', unit: 'best on team', of: (r) => r.bestOnTeam, perGame: true },
  { key: 'teamOfDay', label: 'Team of the Day', unit: 'Team of Day', of: (r) => r.teamOfDay, perGame: true },
  { key: 'games', label: 'Games played', unit: 'played', of: (r) => r.games, perGame: false },
];

const nameOf = (r: Row) => r.player.nickname || `${r.player.firstName} ${r.player.lastName}`.trim();

/**
 * Every player in the group, ranked by one number, like FPL's player stats: rating, goals,
 * assists, Player of the Match and the rest, in totals or per game. Rating rows show what the
 * number is made of. Tapping a player opens their profile.
 */
export function GroupStats({ groupId, sort, onSort }: { groupId: string; sort: StatSort; onSort: (s: StatSort) => void }) {
  const [table, setTable] = useState<LeagueTable | null>(null);
  const [parts, setParts] = useState<Map<string, RatingTrial['rows'][number]>>(new Map());
  const [failed, setFailed] = useState<string | false>(false);
  const [per, setPer] = useState<'total' | 'game'>('total');

  const load = useCallback(() => {
    setFailed(false);
    getGroupTable(groupId)
      .then(setTable)
      .catch((err) => setFailed(err instanceof Error ? err.message : ''));
    // What each rating is made of; the list still works without it.
    getRatingTrial(groupId)
      .then((t) => setParts(new Map(t.rows.map((r) => [r.player.id, r]))))
      .catch(() => setParts(new Map()));
  }, [groupId]);
  useEffect(() => {
    setTable(null);
    load();
  }, [load]);

  const stat = STATS.find((s) => s.key === sort) ?? STATS[0];
  const byGame = per === 'game' && stat.perGame;
  const value = (r: Row) => (byGame ? (r.games ? stat.of(r) / r.games : 0) : stat.of(r));
  const fmt = (n: number) => (byGame ? String(Math.round(n * 100) / 100) : String(n));

  const played = (table?.rows ?? []).filter((r) => r.games > 0);
  const rows = [...played].sort((a, b) => value(b) - value(a) || (b.ovr ?? 0) - (a.ovr ?? 0) || nameOf(a).localeCompare(nameOf(b)));
  const notYet = (table?.rows.length ?? 0) - played.length;

  return (
    <section aria-labelledby="stats-title">
      <h2 id="stats-title" className="text-base font-bold text-ink">
        Stats
      </h2>
      <p className="mb-2.5 text-xs text-gray-500">Every player, ranked. Pick what to rank by.</p>
      <FilterBar>
        <FilterMenu
          label="Rank by"
          title="Rank by"
          value={sort}
          onChange={onSort}
          columns={2}
          options={STATS.map((s) => ({ value: s.key, label: s.label }))}
        />
        {stat.perGame && (
          <FilterMenu
            label="Show"
            value={per}
            onChange={setPer}
            columns={2}
            options={[
              { value: 'total', label: 'Totals' },
              { value: 'game', label: 'Per game' },
            ]}
          />
        )}
      </FilterBar>

      {failed !== false ? (
        <div className="py-10 text-center" role="alert">
          <p className="text-sm text-gray-600">Stats didn&apos;t load.</p>
          {failed && <p className="mt-1 text-[12px] text-gray-500">The server said: “{failed}”</p>}
          <button onClick={load} className="mt-2 h-11 px-3 text-sm font-bold text-pitch-700">
            Try again
          </button>
        </div>
      ) : !table ? (
        <div className="mt-3 h-64 rounded-3xl bg-gray-100 animate-pulse" aria-busy aria-label="Loading stats" />
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-3xl bg-chalk px-4 py-8 text-center text-sm text-gray-600">No one has played a game with scores yet.</p>
      ) : (
        <ol className="mt-3 bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 overflow-hidden" aria-label={`Ranked by ${stat.label}`}>
          {rows.map((r, i) => {
            const v = value(r);
            // Level players share a place.
            const place = 1 + rows.findIndex((x) => value(x) === v);
            const p = parts.get(r.player.id);
            const name = nameOf(r);
            return (
              <li key={r.player.id} className="animate-rise" style={stagger(Math.min(i, 12), 20, 0)}>
                <Link href={`/players/${r.player.id}`} className="press flex items-center gap-3 min-h-16 px-3.5 py-2.5 hover:bg-chalk/60">
                  <span className={`w-6 shrink-0 text-center font-display text-[15px] font-extrabold tabular-nums ${place <= 3 && v > 0 ? 'text-pitch-700' : 'text-gray-400'}`}>
                    {place}
                  </span>
                  <Avatar name={name} photoKey={r.player.photoKey} className="w-9 h-9 text-[11px]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-ink truncate">{name}</span>
                    {sort === 'rating' && p ? (
                      <span className="mt-1 grid grid-cols-3 gap-1.5" aria-label={`Stats ${p.parts.stats}, votes ${p.parts.votes}, results ${p.parts.results}`}>
                        {(['stats', 'votes', 'results'] as const).map((k) => (
                          <span key={k} className="min-w-0" aria-hidden>
                            <span className="flex items-baseline justify-between text-[10px] font-bold text-gray-500">
                              <span className="capitalize">{k}</span>
                              <span className="tabular-nums text-ink">{p.parts[k]}</span>
                            </span>
                            <span className="mt-0.5 block h-1 rounded-full bg-gray-100">
                              <span className="block h-1 rounded-full bg-pitch-500" style={{ width: `${((p.parts[k] - 40) / 59) * 100}%` }} />
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="block text-[12px] text-gray-500 tabular-nums truncate">
                        {r.games} played · {r.goals} G · {r.assists} A{r.potmWins ? ` · ★ ${r.potmWins}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-[20px] leading-none font-extrabold text-ink tabular-nums">{fmt(v)}</span>
                    <span className="block mt-0.5 text-[10px] font-bold text-gray-500">{byGame ? `${stat.unit} a game` : stat.unit}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {table && notYet > 0 && (
        <p className="mt-2 px-1 text-[12px] text-gray-500">
          {notYet} player{notYet === 1 ? ' hasn’t' : 's haven’t'} played a game with scores yet.
        </p>
      )}
      {sort === 'rating' && (
        <p className="mt-2 px-1 text-[11px] leading-snug text-gray-500">
          Rating: 40% stats (goals and assists), 40% votes (Player of the Match, Best VII, awards), 20% team results, each against the rest of the club. 70 is
          the middle.
        </p>
      )}
    </section>
  );
}
