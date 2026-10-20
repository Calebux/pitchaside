'use client';

import { useEffect, useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import type { RatingBreakdown } from '@/lib/api';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "How Ada's 80 is made": the card number's three parts, each with its score, its share of the
 * number, what went into it in plain words, and where the player stands in the club on it. Then
 * the sum. `load` fetches it (the organiser's route or the player app's).
 */
export function RatingBreakdownSheet({ name, load, onClose }: { name: string; load: () => Promise<RatingBreakdown | null | undefined>; onClose: () => void }) {
  const titleId = useId();
  const [data, setData] = useState<RatingBreakdown | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((b) => setData(b ?? null))
      .catch((err) => setFailed(err instanceof Error ? err.message : ''));
    // Loaded once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = name.split(' ')[0];
  const title = data ? `How ${first}’s ${data.rating} is made` : `How ${first}’s rating is made`;

  const parts = data
    ? [
        {
          key: 'stats',
          label: 'Stats',
          score: data.stats.score,
          weight: data.weights.stats,
          place: data.stats.place,
          lines: [
            `${plural(data.stats.goals, 'goal')}, ${plural(data.stats.assists, 'assist')} in ${plural(data.stats.games, 'game')}`,
            data.stats.saves ? `${plural(data.stats.saves, 'save')} (each worth a tenth of a goal)` : null,
            data.stats.yellowCards || data.stats.redCards
              ? `${[data.stats.yellowCards ? plural(data.stats.yellowCards, 'yellow card') : null, data.stats.redCards ? plural(data.stats.redCards, 'red card') : null]
                  .filter(Boolean)
                  .join(', ')}: a yellow costs a quarter of a goal, a red a whole goal`
              : null,
            'An assist counts three quarters of a goal. Per game, against the club.',
          ],
        },
        {
          key: 'votes',
          label: 'Votes',
          score: data.votes.score,
          weight: data.weights.votes,
          place: data.votes.place,
          lines: data.votes.ballots
            ? [
                `Player of the Match on ${data.votes.potmVotes} of ${plural(data.votes.ballots, 'ballot')} they could be on${data.votes.potmWins ? ` (won it ${plural(data.votes.potmWins, 'time')})` : ''}`,
                data.votes.viiPicks ? `In ${plural(data.votes.viiPicks, 'Best VII')} picked by teammates` : 'Not in anyone’s Best VII yet',
                data.votes.awards.length ? `${plural(data.votes.awards.length, 'award')} with enough voters` : 'No awards with enough voters yet',
              ]
            : ['No votes yet, so this sits in the middle. It never counts against them.'],
        },
        {
          key: 'results',
          label: 'Results',
          score: data.results.score,
          weight: data.weights.results,
          place: data.results.place,
          lines: [
            `Their teams won ${data.results.record.w}, drew ${data.results.record.d}, lost ${data.results.record.l}`,
            'Beating stronger sides counts for more. This is also what balances teams.',
          ],
        },
      ]
    : [];

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left">
      <SheetTitle id={titleId} title={title} sub="40% stats, 40% votes, 20% results, each against the rest of the club. 70 is the middle." onClose={onClose} />
      {failed !== null ? (
        <p className="mt-6 text-center text-sm text-gray-600" role="alert">
          This didn’t load.{failed ? ` The server said: “${failed}”` : ''}
        </p>
      ) : data === undefined ? (
        <div className="mt-4 space-y-2" aria-busy aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-3xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : data === null ? (
        <p className="mt-6 rounded-3xl bg-chalk px-4 py-6 text-center text-sm text-gray-600">
          {first} hasn’t played a game with scores yet. Until then the card shows the level their organiser gave them.
        </p>
      ) : (
        <>
          <ol className="mt-4 space-y-2">
            {parts.map((p) => (
              <li key={p.key} className="rounded-3xl bg-white border border-gray-100 shadow-card px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-bold text-ink">
                    {p.label} <span className="text-[12px] font-semibold text-gray-500">· {Math.round(p.weight * 100)}% of the number</span>
                  </span>
                  <span className="font-display text-[22px] leading-none font-extrabold text-ink tabular-nums">{p.score}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100" aria-hidden>
                  <div className="h-2 rounded-full bg-pitch-500 animate-fill-grow" style={{ width: `${((p.score - 40) / 59) * 100}%` }} />
                </div>
                <p className={`mt-1 text-[12px] font-bold ${p.place !== null && p.place <= 3 ? 'text-pitch-700' : 'text-gray-500'}`}>
                  {p.place === null ? 'Level with everyone in the club so far' : `${ordinal(p.place)} of ${data.of} in the club`}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[13px] leading-snug text-gray-600">
                  {p.lines.filter(Boolean).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-2xl bg-chalk px-4 py-3 text-[13px] text-gray-700 tabular-nums">
            {Math.round(data.weights.stats * 100)}% of {data.stats.score} + {Math.round(data.weights.votes * 100)}% of {data.votes.score} +{' '}
            {Math.round(data.weights.results * 100)}% of {data.results.score} = <b className="text-ink">{data.rating}</b>
          </p>
        </>
      )}
    </Sheet>
  );
}
