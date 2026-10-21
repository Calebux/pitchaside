'use client';

import { useCallback, useEffect, useState } from 'react';
import { LeagueTableView } from '@/components/ratings';
import type { LeagueTable } from '@/lib/api';
import { Avatar } from '@/components/ratings';
import { InfoTip } from '@/components/info-tip';
import { ORGANISER_CLUB, type ClubApi, type StatSort } from './group-stats';
import { ShareCardButton, ShareIcon, shareIconLight } from '@/components/share-card';

const RECENT_DAYS = 5;

/** A group's season table, with its own loading and "didn't load" states. */
export function GroupTable({
  groupId,
  groupName,
  onSeeAll,
  api = ORGANISER_CLUB,
}: {
  groupId: string;
  /** For the shared table's message. */
  groupName?: string;
  onSeeAll?: (sort: StatSort) => void;
  api?: ClubApi;
}) {
  const [table, setTable] = useState<LeagueTable | null>(null);
  const [failed, setFailed] = useState<string | false>(false);
  // The whole season, or only the latest match days.
  const [recent, setRecent] = useState(false);
  // How many match days the season has, so the switch only shows when it changes something.
  const [seasonDays, setSeasonDays] = useState(0);

  const load = useCallback(() => {
    setFailed(false);
    api.table(groupId, recent ? RECENT_DAYS : undefined)
      .then((t) => {
        setTable(t);
        if (!recent) setSeasonDays(t.games);
      })
      .catch((err) => setFailed(err instanceof Error ? err.message : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, recent]);

  useEffect(() => {
    setTable(null);
    load();
  }, [load]);

  return (
    <section aria-labelledby="table-title">
      <div className="mb-2">
        <div className="flex items-center justify-between gap-3 min-h-11">
        <h2 id="table-title" className="flex items-center gap-2 text-base font-bold text-ink">
          Table
          {table && (
            <InfoTip label="How the table works">
              <span className="block font-bold text-volt-300">How points are won</span>
              <span className="block mt-1">
                Win a game: {table.points.win} · Draw: {table.points.draw} · Team of the Day: {table.points.teamOfDay} · Player of the Match: {table.points.potm}
              </span>
              <span className="block mt-2">
                <b>P</b> games played. <b>★</b> Player of the Match wins. <b>W D L</b> games won, drawn and lost. Team of the Day is the side that finished top on a match day.
              </span>
            </InfoTip>
          )}
        </h2>
        {table?.shareCode && table.rows.length > 0 && (
          <ShareCardButton
            page={`/g/${table.shareCode}/table${recent ? `?last=${RECENT_DAYS}` : ''}`}
            heading="Share the table"
            fileName="pitchaside-table.png"
            caption={`📊 ${groupName ?? 'Our'} table${recent ? ` · last ${RECENT_DAYS} match days` : ''}. Where do you stand?`}
            label="Share the table"
            className={shareIconLight}
          >
            <ShareIcon />
          </ShareCardButton>
        )}
        </div>
        <p className="-mt-1 text-xs text-gray-500">Points from results, Team of the Day and Player of the Match</p>
        {/* The table as an image for WhatsApp: the season, or the last few match days, as shown */}
      </div>
      {seasonDays > RECENT_DAYS && (
        <div role="radiogroup" aria-label="Which match days" className="mb-3 flex gap-2">
          {[
            { on: !recent, label: 'This season', pick: () => setRecent(false) },
            { on: recent, label: `Last ${RECENT_DAYS} match days`, pick: () => setRecent(true) },
          ].map((o) => (
            <button
              key={o.label}
              role="radio"
              aria-checked={o.on}
              onClick={o.pick}
              className={`press min-h-11 px-3.5 rounded-2xl text-sm font-bold transition-colors ${o.on ? 'bg-ink text-volt-300' : 'bg-white border border-gray-200 text-ink hover:border-ink'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {table ? (
        <>
          <LeagueTableView table={table} />
          <Leaders table={table} onSeeAll={onSeeAll} />
        </>
      ) : failed !== false ? (
        <div className="py-10 text-center" role="alert">
          <p className="text-sm text-gray-600">The table didn&apos;t load.</p>
          {failed && <p className="mt-1 text-[12px] text-gray-500">The server said: “{failed}”</p>}
          <button onClick={load} className="mt-2 h-11 px-3 text-sm font-bold text-pitch-700">
            Try again
          </button>
        </div>
      ) : (
        <div className="h-40 bg-gray-100 rounded-3xl animate-pulse" aria-busy aria-label="Loading the table" />
      )}
    </section>
  );
}

/**
 * The season's leaders: the top three in goals, assists, Player of the Match and Best VII of the
 * Day. All four boards always show, so goals and assists are there before anyone has one; each
 * opens the full ranked list in Stats.
 */
function Leaders({ table, onSeeAll }: { table: LeagueTable; onSeeAll?: (sort: StatSort) => void }) {
  const boards = (
    [
      ['goals', 'Goals', 'No goals recorded yet. Add scorers on match day.', (r) => r.goals],
      ['assists', 'Assists', 'No assists recorded yet.', (r) => r.assists],
      ['potm', 'Player of the Match', 'Comes from the vote after each game.', (r) => r.potmWins],
      ['vii', 'Best VII of the Day', 'Comes from the vote after each game.', (r) => r.viiOfDay],
    ] as [StatSort, string, string, (r: LeagueTable['rows'][number]) => number][]
  ).map(([key, title, none, of]) => ({
    key,
    title,
    none,
    top: [...table.rows]
      .filter((r) => (of(r) ?? 0) > 0)
      .sort((a, b) => of(b) - of(a))
      .slice(0, 3)
      .map((r) => ({ id: r.player.id, name: r.player.nickname || `${r.player.firstName} ${r.player.lastName}`, photoKey: r.player.photoKey, value: of(r) })),
  }));
  return (
    <section aria-labelledby="leaders-title" className="mt-6">
      <h2 id="leaders-title" className="text-base font-bold text-ink">
        Leaders
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {boards.map((b) => (
          <div key={b.key} className="min-w-0 flex flex-col rounded-3xl bg-white border border-gray-100 shadow-card p-3">
            <h3 className="text-[12px] font-extrabold text-gray-600">{b.title}</h3>
            {b.top.length ? (
              <ol className="mt-1.5 space-y-1.5">
                {b.top.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 min-w-0">
                    <span className="w-3 text-[11px] font-extrabold text-gray-400 tabular-nums">{i + 1}</span>
                    <Avatar name={p.name} photoKey={p.photoKey} className="w-6 h-6 text-[9px]" />
                    <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-ink">{p.name}</span>
                    <span className="font-display text-[15px] font-extrabold text-ink tabular-nums">{p.value}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1.5 text-[12px] leading-snug text-gray-500">{b.none}</p>
            )}
            {onSeeAll && (
              <button onClick={() => onSeeAll(b.key)} className="press mt-auto pt-1.5 -mb-1 min-h-11 text-left text-[12px] font-bold text-pitch-700">
                See all ›
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
