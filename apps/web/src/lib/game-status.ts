import { VOTE_HOURS } from '@pitchaside/shared';
import type { ISessionWithDetails } from './api';
import { daysFromToday } from '@/components/money-card';

export type Tone = 'live' | 'warn' | 'calm' | 'done' | 'off';
export const toneCls: Record<Tone, string> = {
  live: 'bg-volt-300 text-ink',
  warn: 'bg-sun-400/25 text-amber-800',
  calm: 'bg-chalk text-gray-700',
  done: 'bg-ink text-white',
  off: 'bg-kit-500/15 text-kit-600',
};

/** The same states on the dark turf card, where the light chips wash out. */
export const toneOnDark: Record<Tone, string> = {
  live: 'bg-volt-300 text-ink',
  warn: 'bg-sun-400 text-ink',
  calm: 'bg-white/15 text-white',
  done: 'bg-white text-ink',
  off: 'bg-kit-500 text-white',
};

/**
 * True while a game is taking votes, by the server's rule (RatingsService.window): from when it
 * was ended, for VOTE_HOURS (36), or until everyone who came has voted, whichever is first. Games ended
 * before the vote moved to full time keep their match-day-plus-a-week window.
 */
export function isVotingOpen(session: Pick<ISessionWithDetails, 'date' | 'kind' | 'status' | 'voteOpensAt' | 'voteClosedAt'>) {
  if (session.kind === 'dues' || session.status !== 'completed') return false;
  const now = Date.now();
  // Everyone who came has voted: it's closed, whatever the clock says.
  if (session.voteClosedAt && new Date(session.voteClosedAt).getTime() <= now) return false;
  if (session.voteOpensAt) {
    const opens = new Date(session.voteOpensAt).getTime();
    return now >= opens && now < opens + VOTE_HOURS * 3_600_000;
  }
  const day = new Date(`${session.date.slice(0, 10)}T00:00:00`).getTime();
  return now >= day && now < day + 8 * 86_400_000;
}

/**
 * The same short states as the home card: In N days / Tomorrow / Today / Not ended / Voting / Final.
 * An ended game reads "Voting" while its vote is open (36 hours from full time) and "Final" after.
 */
export function gameChip(s: ISessionWithDetails): { text: string; tone: Tone } {
  const days = daysFromToday(s.date);
  if (s.status === 'cancelled') return { text: 'Cancelled', tone: 'off' };
  if (s.kind === 'dues') return s.status === 'completed' ? { text: 'Closed', tone: 'done' } : { text: 'Collecting', tone: 'live' };
  if (s.status === 'completed') return isVotingOpen(s) ? { text: 'Voting', tone: 'live' } : { text: 'Final', tone: 'done' };
  if (days < 0) return { text: 'Not ended', tone: 'warn' };
  if (days === 0) return { text: 'Today', tone: 'live' };
  return { text: days === 1 ? 'Tomorrow' : `In ${days} days`, tone: 'calm' };
}

