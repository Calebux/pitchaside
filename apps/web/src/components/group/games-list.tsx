'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, getSessionsPaginated, type GameList, type ISessionWithDetails } from '@/lib/api';
import { daysFromToday, gameDay, gameMoney } from '@/components/money-card';
import { gameChip, toneCls } from '@/lib/game-status';
import { prettyTime } from '@/components/player-ui';
import { Pagination } from '@/components/pagination';
import { stagger } from '@/components/motion';

type GroupInfo = { id: string; name: string; targetPlayers: number; kickoffTime?: string | null; location?: string | null };

const LISTS: { key: GameList; label: string; empty: string }[] = [
  { key: 'ahead', label: 'Coming up', empty: 'No games coming up.' },
  { key: 'collect', label: 'To collect', empty: 'Nothing to collect. Everyone who played has paid.' },
  { key: 'past', label: 'Played', empty: 'No games played yet.' },
];

/** A game as a card you can tap: a date block, what it is, where it stands, and a chevron. */
function GameCard({ s, group, showGroup, index }: { s: ISessionWithDetails; group?: GroupInfo; showGroup: boolean; index: number }) {
  const chip = gameChip(s);
  const { payments, paid, owing } = gameMoney(s);
  const noShows = (s.payments ?? []).filter((p) => p.attendance === 'no_show').length;
  const collected = Number(s.collectedAmount);
  const owed = owing.reduce((sum, p) => sum + Number(p.amount), 0);
  // Money is measured against what the players who are in owe, never the empty places.
  const due = collected + owed;
  const pct = due > 0 ? Math.min(100, Math.round((collected / due) * 100)) : 0;
  const ahead = s.status === 'upcoming' && daysFromToday(s.date) >= 0;
  const isDues = s.kind === 'dues';
  const day = gameDay(s.date);
  const places = group?.targetPlayers ?? 0;
  const time = isDues ? null : prettyTime(s.kickoffTime || group?.kickoffTime);

  const squad = isDues
    ? `${paid.length} of ${payments.length} paid`
    : !payments.length
      ? ahead
        ? 'No one’s in yet'
        : s.status === 'cancelled'
          ? 'Called off'
          : 'No one played'
      : ahead
        ? places
          ? `${payments.length} of ${places} in`
          : `${payments.length} in`
        : `${payments.length} played${noShows ? ` · ${noShows} didn’t come` : ''}`;
  const money = !due
    ? null
    : owing.length
      ? ahead
        ? { text: `${formatCurrency(collected)} paid`, warn: false }
        : { text: `${formatCurrency(owed)} to collect`, warn: true }
      : { text: `${formatCurrency(collected)} · all paid`, warn: false };

  // Across groups the group leads; in one group's list the squad does. The venue is on the game page.
  const heading = isDues && s.label ? `${s.label} dues` : showGroup ? group?.name ?? 'Game' : squad;
  const detail = [showGroup ? squad : time, money?.text].filter(Boolean);

  return (
    <li className="animate-rise" style={stagger(Math.min(index, 10), 35, 0)}>
      <Link
        href={`/sessions/${s.id}`}
        className="press group flex items-center gap-3.5 p-3.5 pr-3 bg-white rounded-3xl border border-gray-100 shadow-card hover:border-gray-300 hover:shadow-lift transition-all"
      >
        {/* Date block: the fastest way to find a game in a list */}
        <span
          className={`w-14 shrink-0 rounded-2xl py-2 text-center ${s.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : ahead ? 'bg-pitch-800 text-white' : 'bg-chalk text-ink'}`}
          aria-hidden
        >
          <span className={`block text-[10px] font-extrabold uppercase tracking-[0.12em] ${ahead ? 'text-volt-300' : 'text-gray-500'}`}>
            {isDues ? 'Dues' : day.toLocaleDateString('en-GB', { weekday: 'short' })}
          </span>
          <span className="block font-display text-[22px] leading-none font-extrabold tabular-nums mt-0.5">{day.getDate()}</span>
          <span className="block text-[11px] font-bold mt-0.5">{day.toLocaleDateString('en-GB', { month: 'short' })}</span>
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="min-w-0 text-[15px] font-bold text-ink truncate">{heading}</span>
            <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${toneCls[chip.tone]}`}>
              {(chip.tone === 'live' || chip.tone === 'warn') && (
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${chip.tone === 'warn' ? 'bg-amber-600' : 'bg-pitch-600'}`} aria-hidden />
              )}
              {chip.text}
            </span>
          </span>
          <span className="mt-0.5 block text-[13px] text-gray-600 tabular-nums truncate">
            {detail.map((d, i) => (
              <span key={d} className={money && d === money.text ? `font-semibold ${money.warn ? 'text-amber-700' : 'text-ink'}` : undefined}>
                {i > 0 && <span className="text-gray-300 font-normal"> · </span>}
                {d}
              </span>
            ))}
          </span>
          {due > 0 && (
            <span className="mt-2 block h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% of what's owed has been paid`}>
              <span className={`block h-full rounded-full ${pct === 100 ? 'bg-pitch-600' : 'bg-sun-400'}`} style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>

        <svg className="w-5 h-5 shrink-0 text-gray-400 group-hover:text-ink group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    </li>
  );
}

/** Where a new game goes: the next slot after the last game coming up. */
function ScheduleTile({ after, onNew }: { after?: ISessionWithDetails; onNew: () => void }) {
  return (
    <li>
      <button
        onClick={onNew}
        className="press w-full flex items-center gap-3.5 p-3.5 rounded-3xl border-2 border-dashed border-gray-300 text-left hover:border-ink hover:bg-white transition-colors"
      >
        <span className="w-14 h-[68px] shrink-0 rounded-2xl bg-volt-300 text-ink flex items-center justify-center" aria-hidden>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-ink">Schedule a game</span>
          <span className="block text-[13px] text-gray-600">
            {after
              ? `Next after ${gameDay(after.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}, or a run of weeks`
              : 'One game, or a run of weeks'}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Games as tappable cards, in three lists: Coming up (soonest first), To collect (played, someone
 * who came still owes) and Played. The same on the Games page (all groups, with a group filter)
 * and a group's Games tab (that group only), so both look and work alike. A new game is scheduled
 * from the end of Coming up, where it will appear. The list and group are kept in the address so
 * Back from a game returns to the same view.
 */
export function GamesBrowser({
  groups,
  groupId,
  canSchedule,
  onNew,
}: {
  groups: GroupInfo[];
  /** A group's Games tab: only its games, no group filter. */
  groupId?: string;
  canSchedule: boolean;
  onNew: () => void;
}) {
  const [when, setWhen] = useState<GameList | null>(null);
  const [pickedGroup, setPickedGroup] = useState<string>('');
  const [page, setPage] = useState(1);
  const [games, setGames] = useState<ISessionWithDetails[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [counts, setCounts] = useState<Record<GameList, number> | null>(null);
  const [failed, setFailed] = useState(false);
  const scope = groupId ?? (pickedGroup || undefined);
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // Start from the address (?when=&group=), so Back from a game lands on the same list.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const w = q.get('when');
    setWhen(w === 'collect' || w === 'past' ? w : 'ahead');
    if (!groupId) setPickedGroup(q.get('group') ?? '');
  }, [groupId]);

  const load = useCallback(() => {
    if (!when) return;
    setFailed(false);
    getSessionsPaginated(page, 10, scope, when)
      .then((res) => {
        setGames(res.data);
        setMeta(res.meta);
        if (res.meta.counts) setCounts(res.meta.counts);
      })
      .catch(() => setFailed(true));
  }, [page, scope, when]);
  useEffect(load, [load]);

  function remember(next: { when?: GameList; group?: string }) {
    const url = new URL(window.location.href);
    if (next.when) url.searchParams.set('when', next.when);
    if (next.group !== undefined) {
      if (next.group) url.searchParams.set('group', next.group);
      else url.searchParams.delete('group');
    }
    window.history.replaceState(null, '', url);
  }

  const showGroup = !groupId && !pickedGroup && groups.length > 1;
  const list = LISTS.find((l) => l.key === when) ?? LISTS[0];
  const lastAhead = when === 'ahead' && games?.length ? games[games.length - 1] : undefined;
  const scheduleHere = canSchedule && when === 'ahead' && meta.page === meta.totalPages;

  return (
    <div>
      {!groupId && groups.length > 1 && (
        <div className="-mx-4 px-4 mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Group">
          {[{ id: '', name: 'All groups' }, ...groups].map((g) => (
            <button
              key={g.id || 'all'}
              role="radio"
              aria-checked={pickedGroup === g.id}
              onClick={() => {
                setPickedGroup(g.id);
                setPage(1);
                setGames(null);
                remember({ group: g.id });
              }}
              className={`shrink-0 h-9 px-3.5 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors ${
                pickedGroup === g.id ? 'bg-ink border-ink text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-ink'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="Which games">
        {LISTS.map((l) => {
          const n = counts?.[l.key];
          const on = when === l.key;
          return (
            <button
              key={l.key}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setWhen(l.key);
                setPage(1);
                setGames(null);
                remember({ when: l.key });
              }}
              className={`press h-11 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 ${on ? 'bg-ink text-volt-300' : 'text-ink hover:bg-chalk'}`}
            >
              {l.label}
              {n !== undefined && n > 0 && (
                <span
                  className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-extrabold leading-5 tabular-nums ${
                    l.key === 'collect' ? (on ? 'bg-sun-400 text-ink' : 'bg-sun-400/30 text-amber-800') : on ? 'bg-white/15 text-white' : 'bg-chalk text-gray-600'
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {failed ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-600">The games didn’t load.</p>
          <button onClick={load} className="mt-2 h-10 px-4 text-sm font-bold text-pitch-700 hover:text-ink">
            Try again
          </button>
        </div>
      ) : !games ? (
        <ul className="mt-4 space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[92px] rounded-3xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </ul>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {games.map((s, i) => (
              <GameCard key={s.id} s={s} group={groupMap.get(s.groupId)} showGroup={showGroup} index={i} />
            ))}
            {scheduleHere && <ScheduleTile after={lastAhead} onNew={onNew} />}
          </ul>
          {games.length === 0 && !scheduleHere && <p className="py-10 text-center text-sm text-gray-500">{list.empty}</p>}
          {meta.totalPages > 1 && (
            <div className="mt-4">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
