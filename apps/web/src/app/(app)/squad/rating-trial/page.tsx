'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { PageHeader } from '@/components/brand';
import { EmptyState } from '@/components/empty-state';
import { Avatar } from '@/components/ratings';
import { getRatingTrial, type RatingTrial } from '@/lib/api';
import { useCurrentGroup } from '@/lib/current-group';

const PARTS = [
  { key: 'stats', label: 'Stats', what: 'goals and assists per game' },
  { key: 'votes', label: 'Votes', what: 'Player of the Match, Best VII and awards' },
  { key: 'results', label: 'Results', what: 'the team results rating' },
] as const;

/**
 * The trial 40/40/20 rating beside each player's card rating, so the organiser can see how it
 * would change things before it's used anywhere. Only organisers can open it.
 */
export default function RatingTrialPage() {
  const params = useSearchParams();
  const { groupId: current } = useCurrentGroup();
  const groupId = params.get('group') ?? current;
  const [data, setData] = useState<RatingTrial | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!groupId) return;
    setFailed(null);
    getRatingTrial(groupId)
      .then(setData)
      .catch((err) => setFailed(err instanceof Error ? err.message : ''));
  }, [groupId]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const pct = (n: number) => `${Math.round(n * 100)}`;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <BackButton label="Squad" />
      <PageHeader eyebrow="Only organisers see this" title="How ratings are made" subtitle="Each player’s rating, what it’s made of, and what the old way gave." />

      <div className="rounded-3xl bg-chalk px-4 py-3.5 text-[13px] leading-snug text-gray-700">
        {data ? (
          <>
            <b>
              {pct(data.weights.stats)}% stats · {pct(data.weights.votes)}% votes · {pct(data.weights.results)}% results.
            </b>{' '}
          </>
        ) : null}
        Each part is where the player stands in the club, from 40 to 99, pulled toward the middle until there are a few games of evidence. No votes yet counts as the
        middle, never as a penalty. It’s the big number on every card, and fair teams use half this, half results.
      </div>

      {failed !== null ? (
        <div className="py-10 text-center" role="alert">
          <p className="text-sm text-gray-600">Ratings didn&apos;t load.</p>
          {failed && <p className="mt-1 text-[12px] text-gray-500">The server said: “{failed}”</p>}
          <button onClick={load} className="mt-2 h-11 px-3 text-sm font-bold text-pitch-700">
            Try again
          </button>
        </div>
      ) : !data ? (
        <div className="mt-4 space-y-2" aria-busy aria-label="Loading ratings">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-3xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="box" title="No one has played yet" description="Ratings show once players have games with scores." />
      ) : (
        <ol className="mt-4 space-y-2">
          {data.rows.map((r, i) => {
            const name = r.player.nickname || `${r.player.firstName} ${r.player.lastName}`.trim();
            const diff = r.oldOvr === null ? null : r.trial - r.oldOvr;
            return (
              <li key={r.player.id} className="rounded-3xl bg-white border border-gray-100 shadow-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-[13px] font-extrabold text-gray-500 tabular-nums">{i + 1}</span>
                  <Avatar name={name} photoKey={r.player.photoKey} className="w-9 h-9 text-[11px]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-ink truncate">{name}</span>
                    <span className="block text-[12px] text-gray-500 tabular-nums">
                      {r.games} game{r.games === 1 ? '' : 's'} · {r.goals} goal{r.goals === 1 ? '' : 's'} · {r.assists} assist{r.assists === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-[22px] leading-none font-extrabold text-ink tabular-nums">{r.trial}</span>
                    <span
                      className={`block mt-1 text-[11px] font-bold tabular-nums ${diff === null || diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-pitch-700' : 'text-kit-600'}`}
                    >
                      {r.oldOvr === null ? '' : `old way ${r.oldOvr}${diff ? ` · ${diff > 0 ? '+' : ''}${diff}` : ' · same'}`}
                    </span>
                  </span>
                </div>
                <dl className="mt-2.5 grid grid-cols-3 gap-2">
                  {PARTS.map((p) => (
                    <div key={p.key} title={p.what}>
                      <div className="flex items-baseline justify-between">
                        <dt className="text-[11px] font-bold text-gray-600">{p.label}</dt>
                        <dd className="font-display text-[13px] font-extrabold text-ink tabular-nums">{r.parts[p.key]}</dd>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100" aria-hidden>
                        <div className="h-1.5 rounded-full bg-pitch-500 animate-fill-grow" style={{ width: `${((r.parts[p.key] - 40) / 59) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 px-1 text-[11px] leading-snug text-gray-500">
        Stats: goals and three quarters of an assist, per game. Votes: how often the ballots they could be on named them Player of the Match or put them in a Best VII, and
        their share of awards with enough voters. Results: the rating that balances teams.
      </p>
    </div>
  );
}
