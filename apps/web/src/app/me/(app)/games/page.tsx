'use client';

import { PageHeader } from '@/components/brand';
import { useCallback, useEffect, useState } from 'react';
import { GameCard, GameRow, LoadError, MatchDayCard } from '@/components/player-ui';
import { getPlayerGames, type RecentMatchDay, type UpcomingGame } from '@/lib/player';

export default function PlayerGamesPage() {
  const [data, setData] = useState<{ upcoming: UpcomingGame[]; recent: RecentMatchDay[] } | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  // Coming up or Played, kept in the address so the back button and a shared link land on it.
  const [tab, setTab] = useState<'ahead' | 'past'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'played' ? 'past' : 'ahead',
  );
  const pickTab = (next: 'ahead' | 'past') => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'past') url.searchParams.set('tab', 'played');
    else url.searchParams.delete('tab');
    window.history.replaceState(window.history.state, '', url);
  };
  const load = useCallback(
    () =>
      getPlayerGames()
        .then((d) => {
          setData(d);
          setFailed(null);
        })
        .catch(setFailed),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Games" subtitle="Your next games, and how the last ones went." />
      {!data && failed ? (
        <LoadError
          what="Your games"
          error={failed}
          onRetry={() => {
            setFailed(null);
            load();
          }}
        />
      ) : !data ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-36 bg-gray-100 rounded-3xl" />
          <div className="h-36 bg-gray-100 rounded-3xl" />
        </div>
      ) : (
        <>
          {/* The organiser's switch: games coming up, or played ones with results and votes */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="Which games">
            {(
              [
                ['ahead', 'Coming up', data.upcoming.length],
                ['past', 'Played', data.recent.length],
              ] as const
            ).map(([key, label, n]) => {
              const on = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => pickTab(key)}
                  className={`press h-11 rounded-xl text-[14px] font-bold transition-colors flex items-center justify-center gap-1.5 ${on ? 'bg-ink text-volt-300' : 'text-ink hover:bg-chalk'}`}
                >
                  {label}
                  {n > 0 && (
                    <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-extrabold leading-5 tabular-nums ${on ? 'bg-white/15 text-white' : 'bg-chalk text-gray-600'}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === 'ahead' ? (
            data.upcoming.length === 0 ? (
              <div className="mt-4 rounded-3xl bg-chalk px-5 py-8 text-center">
                <p className="text-[15px] font-bold text-ink">No games coming up</p>
                <p className="mt-1 text-[13px] text-gray-600">You’ll get a ping when your organiser sets the next one.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {/* The next game in full; later ones as cards that open their own page */}
                <div className="md:max-w-xl">
                  <GameCard game={data.upcoming[0]} onChange={load} />
                </div>
                {data.upcoming.length > 1 && (
                  <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                    {data.upcoming.slice(1).map((g, i) => (
                      <GameRow key={g.id} game={g} index={i} />
                    ))}
                  </div>
                )}
              </div>
            )
          ) : data.recent.length === 0 ? (
            <div className="mt-4 rounded-3xl bg-chalk px-5 py-8 text-center">
              <p className="text-[15px] font-bold text-ink">No games played yet</p>
              <p className="mt-1 text-[13px] text-gray-600">Your results, votes and Player of the Match show up here after your first game.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
              {data.recent.map((d, i) => (
                <MatchDayCard key={d.sessionId} day={d} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
