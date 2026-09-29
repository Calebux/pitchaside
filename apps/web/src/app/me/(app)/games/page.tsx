'use client';

import { useCallback, useEffect, useState } from 'react';
import { GameCard, MatchDayCard, PageTitle, Section } from '@/components/player-ui';
import { getPlayerGames, type RecentMatchDay, type UpcomingGame } from '@/lib/player';

export default function PlayerGamesPage() {
  const [data, setData] = useState<{ upcoming: UpcomingGame[]; recent: RecentMatchDay[] } | null>(null);
  const load = useCallback(() => getPlayerGames().then(setData).catch(() => {}), []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageTitle eyebrow="Fixtures & results" title="Games" />
      {!data ? (
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
                {data.upcoming.map((g) => (
                  <GameCard key={g.id} game={g} onChange={load} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Recent">
            {data.recent.length === 0 ? (
              <p className="text-sm text-gray-500 bg-chalk rounded-2xl px-4 py-5 text-center">Your results will show up here after your first game.</p>
            ) : (
              <div className="space-y-3">
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
