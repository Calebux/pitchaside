'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MatchClock } from '@/components/match-clock';
import type { ClockAction } from '@/lib/api';
import { actOnPlayerClock, getPlayerClock, subscribePlayerPush } from '@/lib/player';

/** The game's match clock on a player's phone — the same clock the organiser sees. */
export default function PlayerClockPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => getPlayerClock(id), [id]);
  const act = useCallback((a: ClockAction) => actOnPlayerClock(id, a), [id]);

  return (
    <div className="max-w-md mx-auto">
      <Link href="/me" className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-ink mb-3">
        ‹ Back
      </Link>
      <MatchClock sessionId={id} load={load} act={act} savePush={subscribePlayerPush} />
      <p className="text-xs text-gray-500 text-center px-6">
        Anyone in the game can run the clock. Everyone with it open hears the whistle at full time.
      </p>
    </div>
  );
}
