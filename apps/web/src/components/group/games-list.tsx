'use client';

import { leftToPay } from '@/lib/game-player';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, getSessionsPaginated, type GameList, type ISessionWithDetails } from '@/lib/api';
import { daysFromToday, gameDay, gameMoney } from '@/components/money-card';
import { gameChip, toneCls } from '@/lib/game-status';
import { prettyTime } from '@/components/player-ui';
import { Pagination } from '@/components/pagination';
import { stagger } from '@/components/motion';

type GroupInfo = { id: string; name: string; targetPlayers: number; kickoffTime?: string | null; location?: string | null };

/** Coming up and Played; "Still owed" narrows Played to games someone who came hasn't paid for. */
type Tab = 'ahead' | 'past';
const TABS: { key: Tab; label: string }[] = [
  { key: 'ahead', label: 'Coming up' },
  { key: 'past', label: 'Played' },
];
const EMPTY: Record<GameList, string> = {
  ahead: 'No games coming up.',
  collect: 'Nothing to collect. Everyone who played has paid.',
  past: 'No games played yet.',
};

/** One of the card's two numbers: what it is, the figure, a line under it, and a bar when it's a share. */
function Stat({
  label,
  value,
  of,
  note,
  share,
  tone = 'ink',
}: {
  label: string;
  value: string;
  of?: string;
  note: string;
  share?: number | null;
  tone?: 'ink' | 'warn' | 'muted';
}) {
  return (
    <span className="min-w-0 block">
      <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">{label}</span>
      <span
        className={`mt-0.5 block font-display text-[20px] leading-tight font-extrabold tabular-nums truncate ${
          tone === 'warn' ? 'text-amber-700' : tone === 'muted' ? 'text-gray-400' : 'text-ink'
        }`}
      >
        {value}
        {of && <span className="text-[14px] font-bold text-gray-400">{of}</span>}
      </span>
      {share != null && (
        <span className="mt-1 block h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
          <span
            className={`block h-full rounded-full animate-fill-grow ${tone === 'warn' ? 'bg-sun-400' : 'bg-pitch-600'}`}
            style={{ width: `${Math.max(share > 0 ? 4 : 0, Math.min(100, share))}%` }}
          />
        </span>
      )}
      <span className={`mt-1 block text-[12px] leading-snug truncate ${tone === 'warn' ? 'text-amber-800 font-semibold' : 'text-gray-600'}`}>{note}</span>
    </span>
  );
}

/**
 * A game as a card you can tap. On top: the date, kick-off and venue, and where it stands (In 5
 * days, Today, Voting…). Below, two separate numbers so they're never read as one: Players (who's
 * in, against the places) and Money (what's been paid, or what's left to collect).
 */
function GameCard({ s, group, index }: { s: ISessionWithDetails; group?: GroupInfo; index: number }) {
  const chip = gameChip(s);
  const { payments, paid, owing } = gameMoney(s);
  const noShows = (s.payments ?? []).filter((p) => p.attendance === 'no_show').length;
  const collected = Number(s.collectedAmount);
  const owed = owing.reduce((sum, p) => sum + leftToPay(p), 0);
  // Money is measured against what the players who are in owe, never the empty places.
  const due = collected + owed;
  const moneyShare = due > 0 ? Math.round((collected / due) * 100) : null;
  const ahead = s.status === 'upcoming' && daysFromToday(s.date) >= 0;
  const off = s.status === 'cancelled';
  const isDues = s.kind === 'dues';
  const day = gameDay(s.date);
  const places = group?.targetPlayers ?? 0;
  const time = isDues ? null : prettyTime(s.kickoffTime || group?.kickoffTime);
  const n = payments.length;

  const title = isDues && s.label ? `${s.label} dues` : time ? `${time} kick-off` : day.toLocaleDateString('en-GB', { weekday: 'long' });
  const sub = isDues ? 'Paid by everyone in the group' : group?.location || null;

  const players = isDues
    ? { value: String(paid.length), of: ` / ${n}`, note: `paid their dues`, share: n ? (paid.length / n) * 100 : null }
    : ahead
      ? n === 0
        ? { value: '0', of: places ? ` / ${places}` : undefined, note: 'No one’s in yet', share: places ? 0 : null }
        : places
          ? {
              value: String(n),
              of: ` / ${places}`,
              note: n >= places ? (n > places ? `in · ${n - places} over` : 'in · full') : `in · ${places - n} place${places - n === 1 ? '' : 's'} left`,
              share: (n / places) * 100,
            }
          : { value: String(n), note: 'in', share: null }
      : n === 0
        ? { value: '0', note: 'No one played', share: null }
        : { value: String(n), note: `played${noShows ? ` · ${noShows} didn’t come` : ''}`, share: null };

  const money: { value: string; note: string; tone: 'ink' | 'warn' | 'muted' } = !due
    ? { value: '—', note: n ? 'Nothing to pay' : 'Nothing due yet', tone: 'muted' }
    : !owing.length
      ? { value: formatCurrency(collected), note: 'Everyone’s paid', tone: 'ink' }
      : ahead
        ? { value: formatCurrency(collected), note: `paid by ${paid.length} of ${paid.length + owing.length}`, tone: 'ink' }
        : { value: formatCurrency(owed), note: `to collect from ${owing.length}`, tone: 'warn' };

  return (
    <li className="animate-rise" style={stagger(Math.min(index, 10), 35, 0)}>
      <Link
        href={`/sessions/${s.id}`}
        className={`press group block p-3.5 bg-white rounded-3xl border border-gray-100 shadow-card hover:border-gray-300 hover:shadow-lift transition-all ${off ? 'opacity-80' : ''}`}
      >
        <span className="flex items-center gap-3">
          {/* Date block: the fastest way to find a game in a list */}
          <span
            className={`w-14 shrink-0 rounded-2xl py-2 text-center ${off ? 'bg-gray-100 text-gray-400' : ahead ? 'bg-pitch-800 text-white' : 'bg-chalk text-ink'}`}
            aria-hidden
          >
            <span className={`block text-[10px] font-extrabold uppercase tracking-[0.12em] ${ahead && !off ? 'text-volt-300' : 'text-gray-500'}`}>
              {isDues ? 'Dues' : day.toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
            <span className="block font-display text-[22px] leading-none font-extrabold tabular-nums mt-0.5">{day.getDate()}</span>
            <span className="block text-[11px] font-bold mt-0.5">{day.toLocaleDateString('en-GB', { month: 'short' })}</span>
          </span>

          <span className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${toneCls[chip.tone]}`}>
              {(chip.tone === 'live' || chip.tone === 'warn') && (
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${chip.tone === 'warn' ? 'bg-amber-600' : 'bg-pitch-600'}`} aria-hidden />
              )}
              {chip.text}
            </span>
            <span className={`mt-1 block text-[16px] font-bold truncate ${off ? 'text-gray-500 line-through' : 'text-ink'}`}>{title}</span>
            {sub && <span className="block text-[13px] text-gray-600 truncate">{sub}</span>}
          </span>

          <svg className="w-5 h-5 shrink-0 self-center text-gray-400 group-hover:text-ink group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </span>

        {off ? (
          <span className="mt-3 block rounded-2xl bg-chalk px-3 py-2 text-[13px] text-gray-600">Called off{n ? `. ${n} had said they were in.` : '.'}</span>
        ) : (
          <span className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
            <Stat label={isDues ? 'Players' : ahead ? 'Players in' : 'Players'} value={players.value} of={players.of} note={players.note} share={players.share} />
            <Stat
              label="Money"
              value={money.value}
              note={money.note}
              tone={money.tone}
              share={money.tone === 'muted' ? null : moneyShare}
            />
          </span>
        )}
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
 * Games as tappable cards: Coming up (soonest first) and Played, with "Still owed" narrowing
 * Played to games where someone who came hasn't paid. While any are owed, Coming up says so at the
 * top. The same on the Games page and a group's Games tab, for the group picked. A new game is
 * scheduled from the end of Coming up, where it will appear. The tab is kept in the address so
 * Back from a game returns to the same view.
 */
export function GamesBrowser({
  groups,
  groupId,
  canSchedule,
  onNew,
}: {
  groups: GroupInfo[];
  /** The group whose games these are; every group's when left out. */
  groupId?: string;
  canSchedule: boolean;
  onNew: () => void;
}) {
  const [when, setWhen] = useState<GameList | null>(null);
  const [page, setPage] = useState(1);
  const [games, setGames] = useState<ISessionWithDetails[] | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [counts, setCounts] = useState<Record<GameList, number> | null>(null);
  const [failed, setFailed] = useState(false);
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // Start from the address (?when=), so Back from a game lands on the same list.
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get('when');
    setWhen(w === 'collect' || w === 'past' ? w : 'ahead');
  }, []);

  // Another group: start again from its first page, and don't show the last group's numbers.
  useEffect(() => {
    setPage(1);
    setGames(null);
    setCounts(null);
  }, [groupId]);

  const load = useCallback(() => {
    if (!when) return;
    setFailed(false);
    getSessionsPaginated(page, 10, groupId, when)
      .then((res) => {
        setGames(res.data);
        setMeta(res.meta);
        if (res.meta.counts) setCounts(res.meta.counts);
      })
      .catch(() => setFailed(true));
  }, [page, groupId, when]);
  useEffect(load, [load]);

  function show(next: GameList) {
    setWhen(next);
    setPage(1);
    setGames(null);
    const url = new URL(window.location.href);
    url.searchParams.set('when', next);
    window.history.replaceState(window.history.state, '', url);
  }

  const tab: Tab = when === 'ahead' ? 'ahead' : 'past';
  const owedGames = counts?.collect ?? 0;
  const lastAhead = when === 'ahead' && games?.length ? games[games.length - 1] : undefined;
  const scheduleHere = canSchedule && when === 'ahead' && meta.page >= meta.totalPages;

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="Which games">
        {TABS.map((t) => {
          const n = counts?.[t.key];
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => !on && show(t.key)}
              className={`press h-11 rounded-xl text-[14px] font-bold transition-colors flex items-center justify-center gap-1.5 ${on ? 'bg-ink text-volt-300' : 'text-ink hover:bg-chalk'}`}
            >
              {t.label}
              {n !== undefined && n > 0 && (
                <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-extrabold leading-5 tabular-nums ${on ? 'bg-white/15 text-white' : 'bg-chalk text-gray-600'}`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Money still owed from played games: the one thing on this page that needs chasing */}
      {tab === 'ahead' && owedGames > 0 && (
        <button
          onClick={() => show('collect')}
          className="press animate-pop-in mt-3 w-full flex items-center gap-3 rounded-2xl bg-sun-400/20 border border-sun-400/50 px-3.5 py-2.5 text-left hover:border-amber-600"
        >
          <span className="w-2 h-2 shrink-0 rounded-full bg-amber-600 animate-pulse-soft" aria-hidden />
          <span className="flex-1 min-w-0 text-[14px] leading-snug text-amber-900">
            <span className="font-bold">
              {owedGames} played game{owedGames === 1 ? '' : 's'} still {owedGames === 1 ? 'has' : 'have'} money owed.
            </span>{' '}
            See who
          </span>
          <svg className="w-4 h-4 shrink-0 text-amber-800" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {tab === 'past' && (
        <div role="radiogroup" aria-label="Show" className="mt-3 flex gap-2">
          {(
            [
              ['past', 'All played'],
              ['collect', owedGames ? `Still owed (${owedGames})` : 'Still owed'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={when === k}
              onClick={() => when !== k && show(k)}
              className={`press min-h-11 px-3.5 rounded-full text-[13px] font-bold border transition-colors ${
                when === k ? 'bg-ink border-ink text-volt-300' : 'bg-white border-gray-200 text-gray-600 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {failed ? (
        <div className="py-10 text-center" role="alert">
          <p className="text-sm text-gray-600">The games didn’t load.</p>
          <button onClick={load} className="mt-2 min-h-11 px-4 text-sm font-bold text-pitch-700 hover:text-ink">
            Try again
          </button>
        </div>
      ) : !games || !when ? (
        <ul className="mt-4 space-y-3" aria-busy aria-label="Loading games">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[150px] rounded-3xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </ul>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {games.map((s, i) => (
              <GameCard key={s.id} s={s} group={groupMap.get(s.groupId)} index={i} />
            ))}
            {scheduleHere && <ScheduleTile after={lastAhead} onNew={onNew} />}
          </ul>
          {games.length === 0 && !scheduleHere && <p className="py-10 text-center text-sm text-gray-500">{EMPTY[when]}</p>}
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
