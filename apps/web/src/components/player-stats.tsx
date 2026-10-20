'use client';

import { useState } from 'react';
import type { ComparedStat, PlayerRatings, StatCompare, VoteCategory } from '@/lib/api';
import { FilterBar, FilterMenu } from '@/components/filter-menu';
import { InfoTip } from '@/components/info-tip';

/** The awards voted on after games, in the ballot's order, with the old Fastest kept as The Engine. */
const AWARDS: { key: VoteCategory; title: string }[] = [
  { key: 'shooting', title: 'Best Finisher' },
  { key: 'passing', title: 'Best Passer' },
  { key: 'dribbling', title: 'Best Dribbler' },
  { key: 'defending', title: 'Best Defender' },
  { key: 'smartest', title: 'Smartest Player' },
  { key: 'engine', title: 'The Engine' },
  { key: 'playmaker', title: 'Best Playmaker' },
  { key: 'movement', title: 'Best Off-Ball Movement' },
  { key: 'keeper', title: 'Best Goalkeeper' },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-card px-2 py-3 text-center">
      <p className="font-display text-2xl font-extrabold text-ink tabular-nums leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-1">{label}</p>
    </div>
  );
}

/** The numbers the tracker compares with the club, in their usual order. */
const TRACKED: { key: ComparedStat; label: string }[] = [
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'potmWins', label: 'Player of the Match' },
  { key: 'viiOfDay', label: 'Best VII of the Day' },
  { key: 'wins', label: 'Games won' },
  { key: 'bestOnTeam', label: 'Best on their team' },
  { key: 'teamOfDay', label: 'Team of the Day' },
  { key: 'saves', label: 'Saves' },
  { key: 'yellowCards', label: 'Yellow cards' },
  { key: 'redCards', label: 'Red cards' },
];

/** Numbers where more is worse: ranked "most", never shown in green. */
const WORSE = new Set<ComparedStat>(['yellowCards', 'redCards']);

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const valueOf = (r: PlayerRatings, k: ComparedStat) => (k === 'wins' ? r.record.w : r[k]);

/**
 * Each number beside the club's: a bar for theirs with a tick at the club average, and where
 * they rank. In totals or per game, in the usual order or best rank first.
 */
function Tracker({ r, compare }: { r: PlayerRatings; compare: StatCompare }) {
  const [per, setPer] = useState<'total' | 'game'>('total');
  const [sort, setSort] = useState<'usual' | 'rank'>('usual');
  const rows = TRACKED.map(({ key, label }) => {
    const c = compare[key];
    const raw = valueOf(r, key);
    const mine = per === 'game' ? (r.games ? raw / r.games : 0) : raw;
    const avg = per === 'game' ? c.avgPerGame : c.avg;
    // Room for both their number and the average, so neither sits at the very end.
    const scale = Math.max(mine, avg * 2, per === 'game' ? 0.5 : 1);
    return { key, label, c, mine, avg, w: (mine / scale) * 100, a: (avg / scale) * 100 };
  });
  // A rank only means something once they have one: a 0 isn't "1st" because everyone else has 0 too.
  const placed = (x: (typeof rows)[number]) => (valueOf(r, x.key) > 0 && !WORSE.has(x.key) ? x.c.rank : 999);
  if (sort === 'rank') rows.sort((x, y) => placed(x) - placed(y));
  // Numbers no one in the club has yet say nothing: one line under the list instead of a row each.
  const nobody = rows.filter((x) => x.c.avg === 0 && valueOf(r, x.key) === 0);
  const shown = rows.filter((x) => !nobody.includes(x));
  const fmt = (n: number) => (per === 'game' ? String(Math.round(n * 100) / 100) : String(n));
  return (
    <div className="mt-5">
      <FilterBar>
        <h3 className="shrink-0 mr-1 text-[15px] font-bold text-ink">Against the club</h3>
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
        <FilterMenu
          label="Sort"
          title="Sort by"
          value={sort}
          onChange={setSort}
          columns={2}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
          }
          options={[
            { value: 'usual', label: 'Usual order' },
            { value: 'rank', label: 'Where they rank best' },
          ]}
        />
      </FilterBar>
      {shown.length > 0 && (
      <ul className="mt-2 bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 px-4">
        {shown.map((x) => (
          <li key={x.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-bold text-ink">{x.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-display text-[18px] font-extrabold text-ink">{fmt(x.mine)}</span>
                <span className="text-[12px] text-gray-500"> · club avg {fmt(x.avg)}</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-2 rounded-full bg-gray-100" aria-hidden>
              <div className={`h-2 rounded-full animate-fill-grow ${WORSE.has(x.key) ? 'bg-kit-400' : 'bg-pitch-500'}`} style={{ width: `${Math.min(100, x.w)}%` }} />
              <span className="absolute -top-[3px] w-0.5 h-3.5 bg-ink rounded" style={{ left: `${Math.min(99, x.a)}%` }} />
            </div>
            <p className={`mt-1 text-[12px] font-bold ${placed(x) <= 3 && !WORSE.has(x.key) ? 'text-pitch-700' : 'text-gray-500'}`}>
              {x.c.rank === 0
                ? 'Not played yet'
                : valueOf(r, x.key) === 0
                  ? x.avg > 0
                    ? 'None yet'
                    : ''
                  : `${WORSE.has(x.key) ? `${ordinal(x.c.rank)} most` : ordinal(x.c.rank)} of ${x.c.of} in the club${per === 'game' ? ' in total' : ''}`}
            </p>
          </li>
        ))}
      </ul>
      )}
      {nobody.length > 0 && (
        <p className="mt-2 px-1 text-[13px] text-gray-600">
          No one in the club has {nobody.map((x) => x.label).join(', ').replace(/, ([^,]*)$/, ' or $1')} yet.
        </p>
      )}
      <p className="mt-1.5 px-1 text-[11px] text-gray-500">The dark tick is the club average. Players level on a number share a place.</p>
    </div>
  );
}

/**
 * A player's numbers and what teammates say about them. Totals for this season or all time;
 * then each award they've been nominated for, as a share of the votes they could have had and
 * from how many different people. Below three people it's "not enough to count yet", and the
 * card isn't moved by it. Being nominated only ever lifts the card.
 */
export function PlayerStats({ ratings, you = false }: { ratings: PlayerRatings; you?: boolean }) {
  const hasSeason = !!ratings.season;
  const [range, setRange] = useState<'season' | 'all'>(hasSeason && ratings.season!.games > 0 ? 'season' : 'all');
  const r = range === 'season' && ratings.season ? ratings.season : ratings;
  const awards = AWARDS.map((a) => ({ ...a, e: r.evidence?.[a.key] })).filter((a) => a.e && a.e.nominations > 0);

  return (
    <section aria-labelledby="stats-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="stats-title" className="flex items-center gap-2 text-lg font-bold text-ink">
          Stats
          <InfoTip label="What these stats mean">
            <span className="block"><b>POTM</b> Player of the Match: most votes after the game.</span>
            <span className="block mt-1"><b>Best VII</b> in the day’s Best VII, picked by everyone’s votes.</span>
            <span className="block mt-1"><b>Best on team</b> voted the best on their own side.</span>
            <span className="block mt-1"><b>Team of day</b> on the side that finished top that match day.</span>
            <span className="block mt-1"><b>Points</b> for the table: wins, draws, Team of the Day and Player of the Match.</span>
          </InfoTip>
        </h2>
        {hasSeason && (
          <div role="radiogroup" aria-label="Show" className="grid grid-cols-2 p-1 bg-white border border-gray-200 rounded-2xl">
            {(
              [
                ['season', 'This season'],
                ['all', 'All time'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={range === k}
                onClick={() => setRange(k)}
                className={`press min-h-10 px-3 rounded-xl text-[13px] font-bold transition-colors ${range === k ? 'bg-ink text-volt-300' : 'text-gray-500 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {r.games === 0 ? (
        <p className="mt-3 rounded-2xl bg-chalk px-4 py-5 text-center text-sm text-gray-600">
          {range === 'season' ? 'No games this season yet.' : 'No games yet.'}
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Games" value={r.games} />
            <Stat label="W-D-L" value={`${r.record.w}-${r.record.d}-${r.record.l}`} />
            <Stat label="Points" value={r.points} />
          </div>
          {r.compare ? (
            <Tracker r={r} compare={r.compare} />
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="Goals" value={r.goals} />
              <Stat label="Assists" value={r.assists} />
              <Stat label="POTM" value={r.potmWins} />
            </div>
          )}
        </>
      )}

      <h3 className="mt-6 text-[15px] font-bold text-ink">What teammates say</h3>
      <p className="text-[13px] leading-snug text-gray-600">
        Awards from the vote after each game. An award counts once 3 different people have named {you ? 'you' : 'them'}; it only ever lifts the card.
      </p>
      {awards.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-chalk px-4 py-5 text-center text-sm text-gray-600">No award nominations yet.</p>
      ) : (
        <ul className="mt-3 bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 overflow-hidden">
          {awards.map(({ key, title, e }) => {
            const pct = Math.round((e!.share || 0) * 100);
            return (
              <li key={key} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-bold text-ink">{title}</span>
                  <span className={`shrink-0 text-[13px] font-bold tabular-nums ${e!.enough ? 'text-ink' : 'text-gray-500'}`}>
                    {e!.enough ? `${pct}% of votes` : 'Not enough yet'}
                  </span>
                </div>
                {e!.enough && (
                  <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${title}: ${pct}% of votes`}>
                    <div className="h-full rounded-full bg-pitch-500 animate-fill-grow" style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
                  </div>
                )}
                <p className="mt-1 text-[12px] text-gray-500 tabular-nums">
                  {e!.nominations} nomination{e!.nominations === 1 ? '' : 's'} from {e!.voters} {e!.voters === 1 ? 'person' : 'people'}, over {e!.games} game
                  {e!.games === 1 ? '' : 's'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
