'use client';

import type { IPayment } from '@pitchaside/shared';
import { CountUpNaira } from '@/components/motion';
import { prettyTime } from '@/components/player-ui';
import { gameDay } from '@/components/money-card';
import { formatCurrency, type ISessionWithDetails } from '@/lib/api';
import { gameChip, toneOnDark } from '@/lib/game-status';
import { gameTally, playerState, type GamePhase } from '@/lib/game-player';

/** Shirts shown on the card; the rest are a count. */
const SHIRTS = 21;

/**
 * The game at a glance, on turf. One headline, chosen by where the game is in its week: before
 * kick-off it's the squad ("12 of 28 in"), once it's played it's the money ("₦19,500 collected").
 * The group is the eyebrow and the date the title, so the card says which game before anything
 * else. Remind sits with the money it's about. One shirt per player: filled when paid, dashed
 * while they still owe, faded when free; no-shows aren't on the pitch.
 */
export function GameHero({
  session,
  coveredByDues,
  phase,
  reminding,
  onRemind,
}: {
  session: ISessionWithDetails;
  coveredByDues: boolean;
  phase: GamePhase;
  reminding: boolean;
  onRemind: () => void;
}) {
  const before = phase === 'before' || phase === 'today';
  const payments = session.payments ?? [];
  const tally = gameTally(payments, coveredByDues, before);
  const onPitch = payments.filter((p) => p.attendance !== 'no_show');
  const chip = gameChip(session);
  const kickoff = session.kickoffTime || session.group?.kickoffTime;
  const collected = Number(session.collectedAmount);
  const due = collected + tally.toPayAmount;
  const pct = due > 0 ? Math.min(100, Math.round((collected / due) * 100)) : 0;
  const places = Number(session.group?.targetPlayers ?? 0);
  const isDues = session.kind === 'dues';
  const title = isDues && session.label ? `${session.label} dues` : gameDay(session.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const where = [!isDues && kickoff ? prettyTime(kickoff) : null, session.group?.location].filter(Boolean).join(' · ');
  const canRemind = tally.toPay > 0 && phase !== 'cancelled' && !coveredByDues;
  // Before the game the squad is the story; after, the money.
  const squadFirst = before && !isDues;

  return (
    <div className="relative bg-pitch-800 rounded-[28px] text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 turf-stripes" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 300" aria-hidden>
        <g stroke="white" strokeOpacity="0.1" strokeWidth="2" fill="none">
          <rect x="12" y="12" width="376" height="276" rx="12" />
          <line x1="12" y1="150" x2="388" y2="150" />
          <circle cx="200" cy="150" r="46" />
        </g>
      </svg>

      <div className="relative p-5">
        {/* Which game: group, then the date as the title, then time and place */}
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 pt-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-volt-300 truncate">{session.group?.name || 'Game'}</p>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full ${toneOnDark[chip.tone]}`}>
            {chip.tone === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse-soft" aria-hidden />}
            {chip.text}
          </span>
        </div>
        <h1 className="mt-1 font-display text-[32px] leading-none font-extrabold tabular-nums">{title}</h1>
        {where && <p className="mt-1.5 text-[14px] font-semibold text-white/70 truncate">{where}</p>}

        {/* The headline: one number, said in words underneath */}
        <div className="mt-5 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
          {squadFirst ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none font-extrabold tabular-nums">{tally.playing}</span>
                <span className="text-[15px] font-bold text-white/65">{places ? `of ${places} in` : 'in'}</span>
              </p>
              <p className="mt-1 text-[14px] font-semibold text-white/80">
                {!tally.playing
                  ? 'No one’s in yet'
                  : places > tally.playing
                    ? `${places - tally.playing} place${places - tally.playing === 1 ? '' : 's'} left`
                    : places
                      ? 'Full'
                      : 'Said they’re in'}
              </p>
              {places > 0 && (
                <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={tally.playing} aria-valuemin={0} aria-valuemax={places} aria-label="Places taken">
                  <div className="h-full rounded-full bg-volt-300 animate-fill-grow" style={{ width: `${Math.min(100, Math.round((tally.playing / places) * 100))}%` }} />
                </div>
              )}
            </>
          ) : coveredByDues ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none font-extrabold tabular-nums">{tally.paid}</span>
                <span className="text-[15px] font-bold text-white/65">of {tally.playing} paid their dues</span>
              </p>
              <p className="mt-1 text-[14px] font-semibold text-white/80">The game is covered by dues</p>
            </>
          ) : (
            <>
              <p className="flex items-baseline gap-2 flex-wrap">
                <CountUpNaira value={collected} className="font-display text-[40px] leading-none font-extrabold tabular-nums" />
                <span className="text-[15px] font-bold text-white/65">collected</span>
              </p>
              <p className={`mt-1 text-[14px] font-semibold ${tally.toPay ? 'text-sun-400' : 'text-volt-300'}`}>
                {!onPitch.length
                  ? 'No one played'
                  : tally.toPay
                    ? `${formatCurrency(tally.toPayAmount)} still to collect from ${tally.toPay}`
                    : 'Everyone who came has paid'}
              </p>
              {due > 0 && (
                <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid so far">
                  <div className={`h-full rounded-full animate-fill-grow ${pct === 100 ? 'bg-volt-400' : 'bg-sun-400'}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </>
          )}

          {onPitch.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1" aria-label="Who has paid">
              {onPitch.slice(0, SHIRTS).map((p: IPayment, i) => {
                const s = playerState(p, coveredByDues, before);
                const paid = s.key === 'paid' || s.key === 'dues_paid';
                const free = s.key === 'free';
                return (
                  <svg key={p.id} viewBox="0 0 48 48" className="w-[26px] h-[26px] animate-kit-on" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }} aria-label={`${p.player?.firstName ?? 'Player'}: ${s.label}`}>
                    <path
                      d="M14 6 L19 4 Q24 8 29 4 L34 6 L45 13 L40 22 L35 19 L35 44 L13 44 L13 19 L8 22 L3 13 Z"
                      fill={paid ? '#d4f53c' : free ? 'rgba(255,255,255,0.25)' : 'transparent'}
                      stroke={!paid && !free ? '#ffc93c' : 'transparent'}
                      strokeWidth="2.5"
                      strokeDasharray={!paid && !free ? '4 3' : undefined}
                      strokeLinejoin="round"
                    />
                    <text x="24" y="34" textAnchor="middle" fontSize="15" fontWeight="800" fill={paid ? '#0f1a14' : 'rgba(255,255,255,0.85)'}>
                      {p.player?.firstName?.charAt(0) ?? '?'}
                    </text>
                  </svg>
                );
              })}
              {onPitch.length > SHIRTS && <span className="ml-1 text-xs font-bold text-white/70 tabular-nums">+{onPitch.length - SHIRTS}</span>}
            </div>
          )}
        </div>

        {/* Money, with the action it needs right next to it */}
        {!isDues && !coveredByDues && onPitch.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <p className="flex-1 min-w-0 text-[13px] leading-snug text-white/75 tabular-nums">
              {squadFirst ? (
                <>
                  <b className="block text-[14px] text-white">{formatCurrency(collected)} paid ahead</b>
                  {tally.toPay > 0 ? <span className="text-sun-400 font-semibold">{tally.toPay} not paid yet</span> : 'Everyone who’s in has paid'}
                </>
              ) : (
                <>
                  <b className="block text-[14px] text-white">
                    {tally.paid} paid{tally.toPay > 0 && <span className="text-sun-400"> · {tally.toPay} to pay</span>}
                  </b>
                  {tally.noShows > 0 ? `${tally.noShows} didn’t come` : `${tally.playing} played`}
                </>
              )}
            </p>
            {canRemind && (
              <button
                onClick={onRemind}
                disabled={reminding}
                className="press shrink-0 inline-flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-full bg-white text-ink text-[13px] font-bold shadow-card hover:bg-volt-300 disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {reminding ? 'Sending…' : `Remind ${tally.toPay}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
