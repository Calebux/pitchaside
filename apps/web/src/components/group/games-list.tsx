'use client';

import Link from 'next/link';
import { formatCurrency, type ISessionWithDetails } from '@/lib/api';
import { daysFromToday, gameDay, gameMoney } from '@/components/money-card';
import { gameChip, toneCls } from '@/lib/game-status';
import { prettyTime } from '@/components/player-ui';

function GameRow({
  s,
  targetPlayers,
  kickoff,
  groupName,
}: {
  s: ISessionWithDetails;
  targetPlayers: number;
  kickoff?: string | null;
  /** Across groups (the Games tab), which group it's for. */
  groupName?: string;
}) {
  const chip = gameChip(s);
  const { payments, paid, owing } = gameMoney(s);
  const noShows = (s.payments ?? []).filter((p) => p.attendance === 'no_show').length;
  const collected = Number(s.collectedAmount);
  const owed = owing.reduce((sum, p) => sum + Number(p.amount), 0);
  // Money is measured against what the players who are in owe, never the full-squad target: empty
  // places aren't owed by anyone. Places are said separately ("12 of 28 in").
  const due = collected + owed;
  const pct = due > 0 ? Math.min(100, Math.round((collected / due) * 100)) : 0;
  const played = s.status === 'completed' || daysFromToday(s.date) < 0;
  const time = s.kind === 'dues' ? null : prettyTime(s.kickoffTime || kickoff);
  const title =
    s.kind === 'dues' && s.label
      ? `${s.label} dues`
      : gameDay(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const line =
    s.kind === 'dues'
      ? `${paid.length} of ${payments.length} paid`
      : !payments.length
        ? played
          ? 'No one played'
          : 'No one’s in yet'
        : played
          ? `${payments.length} played${owing.length ? `, ${owing.length} to pay` : ', all paid'}${noShows ? `, ${noShows} didn’t come` : ''}`
          : `${payments.length} of ${targetPlayers} in`;
  // Paid through a monthly (weekly…) due: there's nothing to collect on the game itself.
  const money = due > 0 ? `${formatCurrency(collected)} of ${formatCurrency(due)} paid` : payments.length ? 'Covered by dues' : null;

  return (
    <li>
      <Link
        href={`/sessions/${s.id}`}
        className="block px-4 py-3.5 hover:bg-chalk transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-[15px] font-bold text-ink">
            {title}
            {time && <span className="font-semibold text-gray-600"> · {time}</span>}
            {groupName && <span className="block text-[13px] font-semibold text-gray-500 truncate">{groupName}</span>}
          </p>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap ${toneCls[chip.tone]}`}>
            {(chip.tone === 'live' || chip.tone === 'warn') && (
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${chip.tone === 'warn' ? 'bg-amber-600' : 'bg-pitch-600'}`} aria-hidden />
            )}
            {chip.text}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[13px] text-gray-600 tabular-nums">
          <span className="truncate">{line}</span>
          {money && <span className="shrink-0 font-semibold text-ink">{money}</span>}
        </div>
        {/* How much of what's owed has come in (text above says the same, so colour isn't the only cue) */}
        {due > 0 && (
          <div
            className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of what's owed has been paid`}
          >
            <div className="h-full rounded-full bg-pitch-600" style={{ width: `${pct}%` }} />
          </div>
        )}
      </Link>
    </li>
  );
}

/**
 * Coming up (soonest first), then played (newest first), each linking to the game page. One
 * group's games, or (with `groupOf`) games across groups, each row naming its group.
 */
export function GamesList({
  sessions,
  targetPlayers,
  kickoff,
  groupOf,
}: {
  sessions: ISessionWithDetails[];
  targetPlayers?: number;
  kickoff?: string | null;
  groupOf?: (s: ISessionWithDetails) => { name: string; targetPlayers: number; kickoffTime?: string | null } | undefined;
}) {
  const ahead = sessions
    .filter((s) => s.status === 'upcoming' && daysFromToday(s.date) >= 0)
    .sort((a, b) => gameDay(a.date).getTime() - gameDay(b.date).getTime());
  const past = sessions
    .filter((s) => !ahead.includes(s))
    .sort((a, b) => gameDay(b.date).getTime() - gameDay(a.date).getTime());
  return (
    <div className="space-y-5">
      {[
        { title: 'Coming up', list: ahead },
        { title: 'Played', list: past },
      ]
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-base font-bold text-ink">
              {g.title} <span className="font-semibold text-gray-400 tabular-nums">{g.list.length}</span>
            </h3>
            <ul className="bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 overflow-hidden">
              {g.list.map((s) => {
                const group = groupOf?.(s);
                return (
                  <GameRow
                    key={s.id}
                    s={s}
                    targetPlayers={group?.targetPlayers ?? targetPlayers ?? 0}
                    kickoff={group?.kickoffTime ?? kickoff}
                    groupName={group?.name}
                  />
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
