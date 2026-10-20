'use client';

import { useCallback, useEffect, useState } from 'react';
import { GameCard, GameRow, LoadError, MatchDayCard, PageTitle, Section } from '@/components/player-ui';
import { getPlayerGames, type RecentMatchDay, type UpcomingGame } from '@/lib/player';

export default function PlayerGamesPage() {
  const [data, setData] = useState<{ upcoming: UpcomingGame[]; recent: RecentMatchDay[] } | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
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
      <PageTitle eyebrow="Fixtures & results" title="Games" />
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
          <Section title="Coming up">
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-gray-500 bg-chalk rounded-2xl px-4 py-5 text-center">No games scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                {/* The next game in full; later ones as rows that open their own game day card. */}
                <div className="md:max-w-xl">
                  <GameCard game={data.upcoming[0]} onChange={load} />
                </div>
                {data.upcoming.length > 1 && (
                  <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                    {data.upcoming.slice(1).map((g) => (
                      <GameRow key={g.id} game={g} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Recent">
            {data.recent.length === 0 ? (
              <p className="text-sm text-gray-500 bg-chalk rounded-2xl px-4 py-5 text-center">Your results will show up here after your first game.</p>
            ) : (
              <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                {data.recent.map((d) => (
                  <MatchDayCard key={d.sessionId} day={d} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </>
  );
}
