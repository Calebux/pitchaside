'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getGameLineup } from '@/lib/player';

/** On the player's game card, for whoever captains a side today: keep the score from here. */
export function KeepScoreLink({ sessionId }: { sessionId: string }) {
  const [can, setCan] = useState(false);
  useEffect(() => {
    getGameLineup(sessionId)
      .then((l) => setCan(!!l.canKeepScore))
      .catch(() => setCan(false));
  }, [sessionId]);
  if (!can) return null;
  return (
    <Link
      href={`/me/games/${sessionId}/score`}
      className="press mt-4 flex items-center gap-3 min-h-14 px-4 rounded-2xl bg-ink text-white hover:bg-pitch-900"
    >
      <span className="w-9 h-9 shrink-0 rounded-xl bg-volt-400 text-ink flex items-center justify-center font-display font-extrabold" aria-hidden>
        C
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold">Keep the score</span>
        <span className="block text-[12px] text-white/70">You’re a captain today: add each game and who scored.</span>
      </span>
      <svg className="w-4 h-4 shrink-0 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}
