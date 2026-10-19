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

/**
 * The same short states as the home card: In N days / Tomorrow / Today / Not ended / Voting / Final.
 * Votes stay open for 8 days from the game day (VOTING_WINDOW_DAYS on the server), so an ended
 * game reads "Voting" for that week and "Final" after.
 */
/** The same states on the dark turf card, where the light chips wash out. */
export const toneOnDark: Record<Tone, string> = {
  live: 'bg-volt-300 text-ink',
  warn: 'bg-sun-400 text-ink',
  calm: 'bg-white/15 text-white',
  done: 'bg-white text-ink',
  off: 'bg-kit-500 text-white',
};

export function gameChip(s: ISessionWithDetails): { text: string; tone: Tone } {
  const days = daysFromToday(s.date);
  if (s.status === 'cancelled') return { text: 'Cancelled', tone: 'off' };
  if (s.kind === 'dues') return s.status === 'completed' ? { text: 'Closed', tone: 'done' } : { text: 'Collecting', tone: 'live' };
  if (s.status === 'completed') return days >= -7 ? { text: 'Voting', tone: 'live' } : { text: 'Final', tone: 'done' };
  if (days < 0) return { text: 'Not ended', tone: 'warn' };
  if (days === 0) return { text: 'Today', tone: 'live' };
  return { text: days === 1 ? 'Tomorrow' : `In ${days} days`, tone: 'calm' };
}

