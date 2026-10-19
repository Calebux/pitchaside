'use client';

import { useState } from 'react';
import type { PlayerRatings, VoteCategory } from '@/lib/api';

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
        <h2 id="stats-title" className="text-lg font-bold text-ink">
          Stats
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Games" value={r.games} />
          <Stat label="W-D-L" value={`${r.record.w}-${r.record.d}-${r.record.l}`} />
          <Stat label="Points" value={r.points} />
          <Stat label="Goals" value={r.goals} />
          <Stat label="Assists" value={r.assists} />
          <Stat label="POTM" value={r.potmWins} />
          <Stat label="Best VII" value={r.viiOfDay} />
          <Stat label="Best on team" value={r.bestOnTeam} />
          <Stat label="Team of day" value={r.teamOfDay} />
        </div>
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
