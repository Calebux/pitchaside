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
  // What they lead: from the server, or worked out from the team sheet when the server is an
  // older one that doesn't say (it still says whether they can keep the score today).
  const me = lineup?.squad.find((p) => p.me);
  const role = lineup?.myRole ?? (me?.captain ? 'captain' : me?.vice ? 'vice' : lineup?.canKeepScore ? 'captain' : null);
  if (!lineup || !role || !lineup.myTeam) return null;

  const what = role === 'captain' ? 'captain' : 'vice-captain';
  const side = teamName(lineup.myTeam, lineup.captains, lineup.bibs);
  const badge = (
    <span className="w-9 h-9 shrink-0 rounded-xl bg-volt-400 text-ink flex items-center justify-center font-display font-extrabold text-[13px]" aria-hidden>
      {role === 'captain' ? 'C' : 'VC'}
    </span>
  );

  if (lineup.canKeepScore) {
    // The day's job for a captain: a white button on the dark card, so it reads as the thing to tap.
    return (
      <Link
        href={`/me/games/${sessionId}/score`}
        className="press mt-4 flex items-center gap-3 min-h-16 pl-3 pr-3.5 py-2.5 rounded-2xl bg-white text-ink shadow-card hover:bg-chalk"
      >
        <span className="w-10 h-10 shrink-0 rounded-xl bg-ink text-volt-300 flex items-center justify-center font-display font-extrabold text-[13px]" aria-hidden>
          {role === 'captain' ? 'C' : 'VC'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-[17px] leading-tight font-extrabold">Keep the score</span>
          <span className="block text-[13px] leading-snug text-gray-600 line-clamp-2 break-words">
            {role === 'captain' ? 'Captain' : 'Vice-captain'} of {side}
          </span>
        </span>
        <span className="w-9 h-9 shrink-0 rounded-full bg-volt-400 flex items-center justify-center" aria-hidden>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0-6.75-6.75M19.5 12l-6.75 6.75" />
          </svg>
        </span>
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
