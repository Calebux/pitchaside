'use client';

import { useCallback, useEffect, useState } from 'react';
import { LeagueTableView } from '@/components/ratings';
import { getGroupTable, type LeagueTable } from '@/lib/api';
import { Avatar } from '@/components/ratings';
import { InfoTip } from '@/components/info-tip';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@pitchaside/shared';

const RECENT_DAYS = 5;

/** A group's season table, with its own loading and "didn't load" states. */
export function GroupTable({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  // The trial rating is the organiser's to judge, not a treasurer's.
  const organiser = !!user && user.role !== UserRole.TREASURER;
  const [table, setTable] = useState<LeagueTable | null>(null);
  const [failed, setFailed] = useState<string | false>(false);
  // The whole season, or only the latest match days.
  const [recent, setRecent] = useState(false);
  // How many match days the season has, so the switch only shows when it changes something.
  const [seasonDays, setSeasonDays] = useState(0);

  const load = useCallback(() => {
    setFailed(false);
    getGroupTable(groupId, recent ? RECENT_DAYS : undefined)
      .then((t) => {
        setTable(t);
        if (!recent) setSeasonDays(t.games);
      })
      .catch((err) => setFailed(err instanceof Error ? err.message : ''));
  }, [groupId, recent]);

  useEffect(() => {
    setTable(null);
    load();
  }, [load]);

  return (
    <section aria-labelledby="table-title">
      <div className="mb-2">
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
        <p className="text-xs text-gray-500">Points from results, Team of the Day and Player of the Match</p>
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
          {organiser && (
            <Link
              href={`/squad/rating-trial?group=${groupId}`}
              className="press mt-3 flex items-center gap-3 min-h-14 px-4 rounded-2xl border border-dashed border-gray-300 bg-white hover:border-ink"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-bold text-ink">Try the new rating</span>
                <span className="block text-[12px] text-gray-500">40% stats, 40% votes, 20% results, next to today’s. Only organisers see it.</span>
              </span>
              <span className="text-gray-400" aria-hidden>
                ›
              </span>
            </Link>
          )}
          <Leaders table={table} />
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

/** The season's leaders: the top three in goals, assists, Player of the Match and Best VII of the Day. */
function Leaders({ table }: { table: LeagueTable }) {
  const boards = (
    [
      ['Goals', (r) => r.goals],
      ['Assists', (r) => r.assists],
      ['Player of the Match', (r) => r.potmWins],
      ['Best VII of the Day', (r) => r.viiOfDay],
    ] as [string, (r: LeagueTable['rows'][number]) => number][]
  )
    .map(([title, of]) => ({
      title,
      top: [...table.rows]
        .filter((r) => (of(r) ?? 0) > 0)
        .sort((a, b) => of(b) - of(a))
        .slice(0, 3)
        .map((r) => ({ id: r.player.id, name: r.player.nickname || `${r.player.firstName} ${r.player.lastName}`, photoKey: r.player.photoKey, value: of(r) })),
    }))
    .filter((b) => b.top.length > 0);
  if (!boards.length) return null;
  return (
    <section aria-labelledby="leaders-title" className="mt-6">
      <h2 id="leaders-title" className="text-base font-bold text-ink">
        Leaders
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {boards.map((b) => (
          <div key={b.title} className="min-w-0 rounded-3xl bg-white border border-gray-100 shadow-card p-3">
            <h3 className="text-[12px] font-extrabold text-gray-600">{b.title}</h3>
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
          </div>
        ))}
      </div>
    </section>
  );
}
