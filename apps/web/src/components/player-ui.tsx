'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ticket } from '@/components/ticket';
import { photoUrl } from '@/lib/http';
import { Ball, Player, kitFor, skins } from '@/components/illustrations';
import { BallSpinner } from '@/components/skeleton';
import { AttributeRow } from '@/components/ratings';
import { TEAMS, teamName } from '@/lib/teams';
import { MatchDayBibs } from '@/components/match-day-bibs';
import { KeepScoreLink } from '@/components/keep-score-link';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ShareCardButton } from '@/components/share-card';
import { CountUp, LiveDot } from '@/components/motion';
import { formatCurrency, type PlayerRatings } from '@/lib/api';
import { setRsvp, type RecentMatchDay, type UpcomingGame } from '@/lib/player';

export function niceDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' }) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', opts);
}

/** Days from today to a game day: 0 today, negative once it's past. */
export function daysFrom(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((d - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

export function daysUntil(iso: string) {
  const n = daysFrom(iso);
  return n < 0 ? 'Played' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
}

export function prettyTime(hhmm?: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/**
 * A player screen that didn't load: says so plainly, with the server's own words when there are
 * any, and a way to try again. A lost connection reads as one, not as "Failed to fetch".
 */
export function LoadError({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  const offline = error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
  // A server crash has no words worth showing; a refusal ("You're not in this game") does.
  const said = !offline && error instanceof Error && error.message && !/internal server error/i.test(error.message) ? error.message : null;
  return (
    <div className="rounded-3xl bg-chalk px-5 py-8 text-center" role="alert">
      <p className="text-[15px] font-bold text-ink">{what} didn’t load.</p>
      <p className="mt-1 text-[13px] text-gray-600">
        {offline ? 'Looks like you’re offline or the signal is weak. Check your connection.' : said ? `The server said: “${said}”` : 'Something went wrong on our side.'}
      </p>
      <button onClick={onRetry} className="press mt-3 min-h-11 px-5 rounded-full bg-ink text-sm font-bold text-volt-300 hover:bg-pitch-900">
        Try again
      </button>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Trading-card portrait + name + attributes. */
export function PlayerCardHero({
  firstName,
  lastName,
  ratings,
  caption,
  photoKey,
  onRatingTap,
}: {
  firstName: string;
  lastName: string;
  ratings: PlayerRatings;
  caption?: string;
  /** Their photo takes the drawn player's place on the card. */
  photoKey?: string | null;
  /** Tapping the big number explains how it's made. */
  onRatingTap?: () => void;
}) {
  const fullName = `${firstName} ${lastName}`;
  const photo = photoUrl(photoKey);
  const kit = kitFor(fullName);
  return (
    <div className="relative rounded-[28px] bg-ink text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 turf-stripes" />
      <div className="relative grid grid-cols-[auto_1fr] gap-4 p-5">
        <div className="relative w-24 rounded-2xl bg-gradient-to-b from-pitch-600 to-pitch-800 border border-white/15 overflow-hidden">
          {onRatingTap && ratings.ovr !== null ? (
            <button
              onClick={onRatingTap}
              aria-label={`Rating ${ratings.ovr}: how it's made`}
              className="press absolute z-10 top-0 left-0 min-w-11 min-h-11 pt-2 pl-2 pr-2 pb-1 text-left leading-none rounded-br-xl hover:bg-white/10"
            >
              <span className="block font-display text-xl font-extrabold text-volt-300 tabular-nums">{ratings.ovr}</span>
              <span className="flex items-center gap-0.5 text-[7px] font-extrabold tracking-[0.14em] text-white/60 mt-0.5">
                OVR
                <span className="w-2.5 h-2.5 rounded-full bg-white/20 text-white text-[7px] leading-[10px] text-center tracking-normal" aria-hidden>
                  i
                </span>
              </span>
            </button>
          ) : (
            <div className="absolute z-10 top-2 left-2 leading-none">
              <p className="font-display text-xl font-extrabold text-volt-300 tabular-nums">{ratings.ovr ?? '–'}</p>
              <p className="text-[7px] font-extrabold tracking-[0.14em] text-white/60 mt-0.5">OVR</p>
            </div>
          )}
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="w-full aspect-[2/3] object-cover" />
              <span className="absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/50" aria-hidden />
            </>
          ) : (
          <svg viewBox="0 0 100 150" className="w-full h-auto mt-3" aria-hidden>
            <Player
              x={50}
              y={146}
              scale={0.82}
              pose="stand"
              kit={kit.hex}
              numberColor={kit.text}
              skin={skins[(firstName.length + lastName.length) % skins.length]}
              hair={(['short', 'afro', 'buzz', 'bun'] as const)[lastName.length % 4]}
              number={firstName.charAt(0) + lastName.charAt(0)}
            />
            <Ball x={84} y={138} r={8} />
          </svg>
          )}
          {ratings.provisional && (
            <p className="absolute z-10 bottom-1.5 inset-x-1.5 text-center rounded-md bg-black/45 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-volt-300" title="Rating is still settling: fewer than 3 games with scores">
              Provisional
            </p>
          )}
        </div>
        <div className="min-w-0">
                    <h1 className="font-display text-2xl font-extrabold leading-tight mt-0.5 truncate">{fullName}</h1>
          <div className="mt-3">
            <AttributeRow ratings={ratings} dark />
          </div>
          {caption && <p className="text-[11px] text-white/50 mt-2">{caption}</p>}
        </div>
      </div>
    </div>
  );
}

/** A later game in the list: one tap opens its game day card. */
export function GameRow({ game }: { game: UpcomingGame }) {
  const d = new Date(game.date);
  const time = prettyTime(game.kickoffTime);
  const status =
    game.myStatus === 'in'
      ? { text: "You're in ✅", cls: 'text-pitch-600' }
      : game.myStatus === 'waitlist'
        ? { text: `Waitlist #${game.waitlistPosition ?? '–'}`, cls: 'text-amber-700' }
        : game.myStatus === 'out'
          ? { text: "You're out", cls: 'text-gray-500' }
          : { text: 'Not replied', cls: 'text-gray-500' };
  return (
    <Link
      href={`/me/games/${game.id}`}
      className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-gray-100 shadow-card hover:border-gray-300 transition-colors"
    >
      <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-gray-200 text-center">
        <span className="block bg-kit-500 text-white text-[9px] font-extrabold uppercase tracking-wider py-0.5">
          {d.toLocaleDateString('en-GB', { month: 'short' })}
        </span>
        <span className="block font-display text-lg font-extrabold text-ink leading-7">{d.getDate()}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-ink truncate">{game.groupName}</span>
        <span className="block text-xs text-gray-500 mt-0.5">
          {niceDate(game.date, { weekday: 'short', day: 'numeric', month: 'short' })}
          {time ? ` · ${time}` : ''}
        </span>
      </span>
      <span className={`text-[11px] font-extrabold whitespace-nowrap ${status.cls}`}>{status.text}</span>
      <span className="text-gray-400" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function GameCard({
  game,
  onChange,
  showDetails = true,
}: {
  game: UpcomingGame;
  onChange: () => Promise<unknown>;
  /** Link to the game's own page (who's playing); off on that page itself. */
  showDetails?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const full = game.confirmed >= game.capacity;
  // Played (or ended): nothing left to reply to.
  const played = game.status === 'completed' || daysFrom(game.date) < 0;
  const paid = game.payment?.status === 'paid';
  const pct = Math.min(100, Math.round((game.confirmed / Math.max(game.capacity, 1)) * 100));
  const time = prettyTime(game.kickoffTime);

  async function reply(status: 'in' | 'out') {
    setBusy(status);
    try {
      const res = await setRsvp(game.id, status);
      toast.success(
        res.status === 'in' ? "You're in ⚽" : res.status === 'waitlist' ? "Game's full: you're on the waitlist" : "You're out",
      );
      await onChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  const days = daysFrom(game.date);
  const owes = game.myStatus === 'in' && game.payment?.status === 'pending' && game.payment.amount > 0;
  // Same pill as the organiser's match-day card: where the game is in time.
  const pill = played
    ? { text: 'Played', live: false }
    : days === 0
      ? { text: 'Today', live: true }
      : { text: days === 1 ? 'Tomorrow' : `In ${days} days`, live: false };
  // Where the player stands, in words and colour both.
  const me = played
    ? game.myStatus === 'in'
      ? { text: 'You played', cls: 'bg-white/[0.08] text-white/80' }
      : null
    : game.myStatus === 'in'
      ? { text: "You're in ✓", cls: 'bg-volt-400 text-ink' }
      : game.myStatus === 'waitlist'
        ? { text: `Waitlist #${game.waitlistPosition ?? '–'}`, cls: 'bg-sun-400 text-ink' }
        : game.myStatus === 'out'
          ? { text: "You're out", cls: 'bg-white/[0.08] text-white/80' }
          : game.requireRsvp
            ? { text: 'Not replied', cls: 'bg-white/[0.08] text-white/80' }
            : null;
  const chevron = (
    <svg className="w-3.5 h-3.5 shrink-0 text-white/45" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
  const primary =
    'press w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-volt-400 text-ink text-[15px] font-extrabold hover:bg-volt-300 disabled:opacity-60 transition-colors';
  const secondary =
    'press w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 text-[15px] font-bold text-white hover:bg-white/10 disabled:opacity-50 transition-colors';

  return (
    <Ticket
      aria-label={`${game.groupName}, ${niceDate(game.date)}`}
      bodyClassName="rounded-[28px] text-white bg-[linear-gradient(160deg,#134927_0%,#10301d_42%,#0f1a14_100%)]"
      stub={
        showDetails ? (
          <Link href={`/me/games/${game.id}`} className="press flex items-center gap-3 h-[52px] px-5 hover:bg-white/[0.04] transition-colors">
            <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-white/85">See who&apos;s playing</span>
            {chevron}
          </Link>
        ) : null
      }
    >
      <div className="absolute inset-0 turf-stripes-soft" aria-hidden />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">{days === 0 ? 'Match day' : played ? 'Last game' : 'Next game'}</span>
            <span className="mt-1 block font-display text-[22px] leading-tight font-extrabold truncate">{game.groupName}</span>
            <span className="mt-1 flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-white/85 truncate">
                {niceDate(game.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                {time ? ` · ${time}` : ''}
              </span>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-bold whitespace-nowrap ${
                  pill.live ? 'bg-volt-400/15 text-volt-300' : 'bg-white/[0.08] text-white/75'
                }`}
              >
                {pill.live && <LiveDot className="bg-volt-400" />}
                {pill.text}
              </span>
            </span>
          </div>
          {me && <span className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap ${me.cls}`}>{me.text}</span>}
        </div>

        {game.requireRsvp && !played && (
          <>
            <div className="mt-4 flex items-baseline gap-1.5 flex-wrap">
              <CountUp value={game.confirmed} className="font-display text-[28px] font-extrabold leading-none" />
              <span className="text-sm text-white/70 tabular-nums">
                of {game.capacity} in{game.waitlist > 0 ? ` · ${game.waitlist} waiting` : full ? ' · full' : ''}
              </span>
            </div>
            <div
              className="mt-2.5 h-2.5 w-full rounded-full bg-white/12 overflow-hidden"
              role="img"
              aria-label={`${game.confirmed} of ${game.capacity} places taken`}
            >
              <div className={`h-full rounded-full origin-left animate-fill-grow ${full ? 'bg-kit-500' : 'bg-volt-400'}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}

        {/* Their money for this game, as a row like the organiser's */}
        {game.myStatus === 'in' && game.payment && game.payment.amount > 0 && (
          <ul className="mt-2.5 -mx-1.5">
            <li>
              {owes ? (
                <Link href="/me/pay" className="press flex items-center gap-2.5 min-h-10 px-1.5 rounded-xl text-[13px] font-semibold text-white/85 hover:bg-white/[0.06] transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-sun-400" aria-hidden />
                  <span className="flex-1 min-w-0 truncate tabular-nums">{formatCurrency(game.payment.amount)} to pay for this game</span>
                  {chevron}
                </Link>
              ) : (
                <p className="flex items-center gap-2.5 min-h-10 px-1.5 text-[13px] font-semibold text-white/85">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-volt-400" aria-hidden />
                  {game.payment.status === 'waived' ? 'Free for you this time' : `Paid ${formatCurrency(game.payment.amount)} ✓`}
                </p>
              )}
            </li>
          </ul>
        )}

        {game.bibsOpen && <MatchDayBibs sessionId={game.id} />}
        {days === 0 && game.status !== 'cancelled' && <KeepScoreLink sessionId={game.id} />}

        {!played && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {game.myStatus === 'in' || game.myStatus === 'waitlist' ? (
              <>
                {owes && (
                  <Link href="/me/pay" className={`${primary} col-span-2`}>
                    Pay {formatCurrency(game.payment!.amount)}
                  </Link>
                )}
                <button onClick={() => (paid ? setConfirmOut(true) : reply('out'))} disabled={!!busy} className={`${secondary} col-span-2`}>
                  {busy === 'out' && <BallSpinner />}
                  {game.myStatus === 'waitlist' ? 'Leave the waitlist' : "I'm out"}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => reply('in')} disabled={!!busy} className={primary}>
                  {busy === 'in' && <BallSpinner />}
                  {full && game.requireRsvp ? 'Join waitlist' : "I'm in"}
                </button>
                <button onClick={() => reply('out')} disabled={!!busy || game.myStatus === 'out'} className={secondary}>
                  {busy === 'out' && <BallSpinner />}
                  I&apos;m out
                </button>
              </>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirmOut}
          variant="danger"
          title="Drop out of this game?"
          message={`You’ve paid ${formatCurrency(game.payment?.amount ?? 0)} for it. It goes to your organiser at ${game.groupName} to sort: kept for a later game, or sent back to you.`}
          confirmLabel="I'm out"
          cancelLabel="Stay in"
          onConfirm={() => {
            setConfirmOut(false);
            reply('out');
          }}
          onCancel={() => setConfirmOut(false)}
        />
      </div>
    </Ticket>
  );
}

/** A finished match day from the player's point of view. */
export function MatchDayCard({ day }: { day: RecentMatchDay }) {
  const played = day.record.w + day.record.d + day.record.l;
  const won = day.myTeam && day.teamOfTheDay === day.myTeam;
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500">{niceDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="font-display text-lg font-extrabold text-ink leading-tight truncate">{day.groupName}</p>
        </div>
        {day.myTeam && (
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink bg-chalk border border-gray-200 rounded-full px-2.5 py-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${TEAMS[day.myTeam].swatch}`} />
            {teamName(day.myTeam, day.captains)}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {played > 0 && (
          <span className="text-xs font-bold text-ink bg-chalk rounded-full px-2.5 py-1 tabular-nums">
            W{day.record.w} D{day.record.d} L{day.record.l}
          </span>
        )}
        {won && <span className="text-xs font-extrabold text-ink bg-volt-400 rounded-full px-2.5 py-1">🏆 Team of the Day</span>}
        {day.potm && (
          <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${day.potm.isMe ? 'bg-sun-400 text-ink' : 'bg-chalk text-gray-600'}`}>
            ★ POTM: {day.potm.isMe ? 'You!' : day.potm.name}
          </span>
        )}
        {!played && !day.potm && <span className="text-xs text-gray-500">No results recorded</span>}
        {day.shareToken && (played > 0 || day.potm) && (
          <ShareCardButton
            token={day.shareToken}
            caption={`⚽ ${day.groupName ?? 'Match day'} — ${niceDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}`}
            className="ml-auto text-xs font-bold text-ink bg-white border-2 border-ink rounded-full px-2.5 py-0.5 hover:bg-volt-300 transition-colors"
          >
            Share ↗
          </ShareCardButton>
        )}
      </div>

      {day.vote && (
        <Link
          href={`/v/${day.vote.token}`}
          className={`mt-3 flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-bold ${
            day.vote.voted ? 'bg-chalk text-gray-600' : 'bg-sun-400 text-ink border-2 border-ink'
          }`}
        >
          {day.vote.voted ? 'You voted — see results' : 'Vote for the stars of the night'}
          <span>›</span>
        </Link>
      )}

      {day.teamOpen && (
        <Link href={`/me/games/${day.sessionId}`} className="mt-3 block text-center text-xs font-bold text-pitch-600 hover:text-ink">
          {day.myTeam ? 'Change your team ›' : 'Which team were you in? ›'}
        </Link>
      )}
    </div>
  );
}
