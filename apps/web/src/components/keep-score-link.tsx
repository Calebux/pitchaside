'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getGameLineup, type GameLineup } from '@/lib/player';
import { teamName } from '@/lib/teams';

/**
 * On the player's game card, for whoever leads a side: on match day, the way in to keep the
 * score; before it, a note that they've been picked and what they'll do on the day.
 */
export function KeepScoreLink({ sessionId, today }: { sessionId: string; today: boolean }) {
  const [lineup, setLineup] = useState<GameLineup | null>(null);
  useEffect(() => {
    getGameLineup(sessionId)
      .then(setLineup)
      .catch(() => setLineup(null));
  }, [sessionId]);
  const role = lineup?.myRole;
  if (!lineup || !role || !lineup.myTeam) return null;

  const what = role === 'captain' ? 'captain' : 'vice-captain';
  const side = teamName(lineup.myTeam, lineup.captains, lineup.bibs);
  const badge = (
    <span className="w-9 h-9 shrink-0 rounded-xl bg-volt-400 text-ink flex items-center justify-center font-display font-extrabold text-[13px]" aria-hidden>
      {role === 'captain' ? 'C' : 'VC'}
    </span>
  );

  if (lineup.canKeepScore) {
    return (
      <Link
        href={`/me/games/${sessionId}/score`}
        className="press mt-4 flex items-center gap-3 min-h-14 px-4 rounded-2xl bg-ink text-white hover:bg-pitch-900"
      >
        {badge}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold">Keep the score</span>
          <span className="block text-[12px] text-white/70">
            You’re {what} of {side} today: add each game and who scored.
          </span>
        </span>
        <svg className="w-4 h-4 shrink-0 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    );
  }
  // Match day but the score isn't theirs to keep (full time, or marked not here): nothing to say.
  if (today) return null;
  return (
    <div className="mt-4 flex items-center gap-3 min-h-14 px-4 py-2.5 rounded-2xl bg-white/[0.07] text-white">
      {badge}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold">
          You’re {what} of {side}
        </span>
        <span className="block text-[12px] text-white/70">On match day you’ll keep the score and who scored from here.</span>
      </span>
    </div>
  );
}
