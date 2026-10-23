'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ScoresStep, type ScoresApi } from '@/components/game/scores-step';
import { useToast } from '@/components/toast';
import { addCaptainEvent, addCaptainGame, addCaptainGoal, deleteCaptainEvent, deleteCaptainGame, deleteCaptainGoal, getGameLineup, getGameTimer, getMatchDay, setCaptainAway } from '@/lib/player';
import type { TimerApi } from '@/components/game-timer';
import type { Lineup, TeamKey } from '@/lib/api';
import { retryKeys } from '@/lib/retry-keys';

const CAPTAIN: ScoresApi = retryKeys(
  {
    addGame: addCaptainGame,
    deleteGame: deleteCaptainGame,
    addGoal: addCaptainGoal,
    deleteGoal: deleteCaptainGoal,
    addEvent: addCaptainEvent,
    deleteEvent: deleteCaptainEvent,
  },
  ['addGame', 'addGoal', 'addEvent'],
);

// Captains see the clock once the organiser starts it; only the organiser runs it.
const CAPTAIN_TIMER: TimerApi = { load: getGameTimer };

/**
 * Keeping the score from a captain's phone, on match day: the organiser's scoreboard, games and
 * scorers. Captains can take back only what captains added; the organiser can change anything.
 */
export default function CaptainScorePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Their own side, so the plan shows its swaps first.
  const [myTeam, setMyTeam] = useState<TeamKey | null>(null);
  useEffect(() => {
    getGameLineup(id).then((l) => setMyTeam(l.myTeam), () => undefined);
  }, [id]);

  const load = useCallback(() => {
    setError(null);
    getMatchDay(id).then(setLineup, (err) => setError(err instanceof Error ? err.message : 'The scores didn’t load.'));
  }, [id]);
  useEffect(load, [load]);
  // The organiser and the other captain save scores too: look again while this is open.
  useEffect(() => {
    const look = () => document.visibilityState === 'visible' && getMatchDay(id).then(setLineup).catch(() => undefined);
    const timer = window.setInterval(look, 20_000);
    document.addEventListener('visibilitychange', look);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', look);
    };
  }, [id]);

  return (
    <>
      <Link
        href={`/me/games/${id}`}
        className="inline-flex items-center gap-1.5 pl-2 pr-3 py-1.5 -ml-1 mb-4 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-full hover:text-ink hover:border-gray-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Game
      </Link>
      <h1 className="font-display text-2xl font-extrabold text-ink">Keep the score</h1>
      <p className="mt-1 mb-4 text-[14px] text-gray-600">Captains and vice-captains keep the score today. The organiser sees every score and can change it.</p>

      {error ? (
        <div className="py-10 text-center" role="alert">
          <p className="text-sm text-gray-600">{error}</p>
          <button onClick={load} className="mt-2 h-11 px-3 text-sm font-bold text-pitch-700">
            Try again
          </button>
        </div>
      ) : !lineup ? (
        <div className="h-80 bg-gray-100 rounded-3xl animate-pulse" aria-busy aria-label="Loading the scores" />
      ) : (
        <ScoresStep
          sessionId={id}
          lineup={lineup}
          dateLabel="match day"
          onLineup={setLineup}
          onError={(m) => toast.error(m)}
          onPickTeams={() => router.push(`/me/games/${id}`)}
          api={CAPTAIN}
          timer={CAPTAIN_TIMER}
          timerWatch
          planRole="captain"
          planAway={setCaptainAway}
          myTeam={myTeam}
          canRemove={(by) => !!by && /\((vice-)?captain\)$/.test(by)}
        />
      )}
    </>
  );
}
