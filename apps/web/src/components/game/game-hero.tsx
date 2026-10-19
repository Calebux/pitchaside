'use client';

import type { IPayment } from '@pitchaside/shared';
import { KeepHyphens } from '@/components/brand';
import { CountUpNaira } from '@/components/motion';
import { prettyTime } from '@/components/player-ui';
import { gameDay } from '@/components/money-card';
import { formatCurrency, type ISessionWithDetails } from '@/lib/api';
import { gameChip, toneOnDark } from '@/lib/game-status';
import { gameTally, playerState } from '@/lib/game-player';

/** Shirts shown on the card; the rest are a count. */
const SHIRTS = 24;

/**
 * The game at a glance, on turf: when, where it stands, and its money measured against what the
 * players who are in (or who came) owe, never the empty places. One shirt per player: filled when
 * paid, dashed while they still owe, faded for played free; no-shows aren't on the pitch.
 */
export function GameHero({ session, coveredByDues, played }: { session: ISessionWithDetails; coveredByDues: boolean; played: boolean }) {
  const payments = session.payments ?? [];
  const tally = gameTally(payments, coveredByDues);
  const onPitch = payments.filter((p) => p.attendance !== 'no_show');
  const chip = gameChip(session);
  const kickoff = session.kickoffTime || session.group?.kickoffTime;
  const collected = Number(session.collectedAmount);
  const due = collected + tally.toPayAmount;
  const pct = due > 0 ? Math.min(100, Math.round((collected / due) * 100)) : 0;
  const places = Number(session.group?.targetPlayers ?? 0);
  const when =
    session.kind === 'dues' && session.label
      ? `${session.label} dues`
      : `${gameDay(session.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}${kickoff ? ` · ${prettyTime(kickoff)}` : ''}`;

  // One line under the money: what's left, in the words the rest of the app uses.
  const line = coveredByDues
    ? `${tally.paid} of ${tally.playing} have paid their dues`
    : !onPitch.length
      ? played
        ? 'No one played'
        : places
          ? `No one’s in yet · ${places} places`
          : 'No one’s in yet'
      : tally.toPay === 0
        ? played
          ? 'Everyone who came has paid'
          : `All ${tally.playing} in have paid`
        : played
          ? `${formatCurrency(tally.toPayAmount)} still to collect from ${tally.toPay}`
          : `${formatCurrency(due)} expected from ${tally.playing} in`;

  return (
    <div className="relative bg-pitch-800 rounded-[28px] text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 turf-stripes" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 300" aria-hidden>
        <g stroke="white" strokeOpacity="0.12" strokeWidth="2" fill="none">
          <rect x="12" y="12" width="376" height="276" rx="12" />
          <line x1="12" y1="150" x2="388" y2="150" />
          <circle cx="200" cy="150" r="46" />
        </g>
      </svg>
      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-white/70 text-[13px] font-semibold tabular-nums">{when}</p>
          <span className={`shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full ${toneOnDark[chip.tone]}`}>{chip.text}</span>
        </div>
        <h1 className="mt-1 font-display text-[28px] leading-[1.05] font-extrabold line-clamp-2">
          <KeepHyphens text={session.group?.name || 'Game'} />
        </h1>

        {coveredByDues ? (
          <p className="mt-5 font-display text-4xl font-extrabold tabular-nums">
            {tally.paid}
            <span className="text-white/50 text-lg font-bold"> / {tally.playing}</span>
          </p>
        ) : (
          <p className="mt-5 flex items-baseline gap-2 flex-wrap">
            <CountUpNaira value={collected} className="font-display text-4xl font-extrabold tabular-nums" />
            {due > 0 && <span className="text-white/55 text-[15px] font-semibold tabular-nums">of {formatCurrency(due)}</span>}
          </p>
        )}
        <p className={`mt-1 text-[15px] font-semibold ${tally.toPay && played ? 'text-sun-400' : 'text-white/85'}`}>{line}</p>

        {!coveredByDues && due > 0 && (
          <div className="mt-3 h-2.5 w-full rounded-full bg-black/25 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid so far">
            <div className={`h-full rounded-full animate-fill-grow ${pct === 100 ? 'bg-volt-400' : 'bg-sun-400'}`} style={{ width: `${pct}%` }} />
          </div>
        )}

        {onPitch.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Who has paid">
            {onPitch.slice(0, SHIRTS).map((p: IPayment, i) => {
              const s = playerState(p, coveredByDues);
              const paid = s.key === 'paid' || s.key === 'dues_paid';
              const free = s.key === 'free';
              return (
                <svg key={p.id} viewBox="0 0 48 48" className="w-7 h-7 animate-kit-on" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }} aria-label={`${p.player?.firstName ?? 'Player'}: ${s.label}`}>
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
            {onPitch.length > SHIRTS && <span className="text-xs font-bold text-white/70 tabular-nums">+{onPitch.length - SHIRTS} more</span>}
          </div>
        )}

        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/75">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-volt-400" aria-hidden />
            <b className="text-white tabular-nums">{tally.paid}</b> paid
          </span>
          {tally.toPay > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border-2 border-dashed border-sun-400" aria-hidden />
              <b className="text-white tabular-nums">{tally.toPay}</b> to pay
            </span>
          )}
          {tally.noShows > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/30" aria-hidden />
              <b className="text-white tabular-nums">{tally.noShows}</b> didn’t come
            </span>
          )}
          {!played && places > 0 && session.kind !== 'dues' && (
            <span className="tabular-nums">
              {tally.playing} of {places} places taken
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
