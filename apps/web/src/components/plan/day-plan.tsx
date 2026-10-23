'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameTimer } from '@pitchaside/shared';
import { setPlanAway, setTimer, type Lineup } from '@/lib/api';
import { buildDay, clockAt, liveDay, type Side } from '@/lib/match-plan';
import { PlanSetupSheet } from './plan-setup-sheet';
import { DayPlanLive, WholePlanSheet, usePeople, type PlanLook } from './plan-view';
import { useToast } from '@/components/toast';

/** The clock as the plan follows it: the timer, and the server's time minus this phone's. */
export interface PlanClock {
  timer: GameTimer;
  offset: number;
}

/**
 * The day plan on match day's Teams and Scores steps. Before the day (and on Teams) it's a
 * summary with the whole plan a tap away; on Scores, while the day is on, it follows the games:
 * what's on, what's next, running late, and each side's swaps.
 *
 * The organiser sets it up and can mark anyone as gone early; a captain sees it and can mark
 * their own players. Without a plan, the organiser gets a card to make one; captains see nothing.
 */
export function DayPlan({
  sessionId,
  lineup,
  onLineup,
  role = 'organiser',
  live = false,
  clock = null,
  onClockChanged,
  onAway,
  myTeam,
}: {
  sessionId: string;
  lineup: Lineup;
  onLineup: (l: Lineup) => void;
  role?: 'organiser' | 'captain';
  /** On the Scores step while the day is on: follow the games. */
  live?: boolean;
  clock?: PlanClock | null;
  /** The organiser set the timer from the plan: the clock should load again. */
  onClockChanged?: () => void;
  /** A captain's own route for "left early"; the organiser's is used otherwise. */
  onAway?: (playerId: string, at: number | null) => Promise<Lineup>;
  myTeam?: Side | null;
}) {
  const toast = useToast();
  const [setting, setSetting] = useState(false);
  const [open, setOpen] = useState(false);
  const people = usePeople(lineup.squad);
  const plan = lineup.plan ?? null;
  const day = useMemo(
    () => (plan ? buildDay({ plan, teamCount: lineup.teamCount, date: lineup.date, squad: lineup.squad }) : null),
    [plan, lineup.teamCount, lineup.date, lineup.squad],
  );
  const look: PlanLook = { captains: lineup.captains, bibs: lineup.bibs, kickoff: lineup.kickoff };

  // The clock ticks the plan on: every second while a game runs (for the swaps), else now and then.
  const [now, setNow] = useState(() => Date.now());
  const started = clock?.timer.startedAt ? Date.parse(clock.timer.startedAt) : NaN;
  const running = Number.isFinite(started) && Date.now() + (clock?.offset ?? 0) < started + (clock?.timer.minutes ?? 0) * 60_000;
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), running ? 1000 : 20_000);
    return () => window.clearInterval(id);
  }, [running]);

  const state = day && plan ? liveDay(day, plan, lineup.games.length, clock?.timer ?? null, now + (clock?.offset ?? 0), lineup.date, lineup.kickoff) : null;

  async function away(playerId: string, at: number | null) {
    try {
      onLineup(await (onAway ? onAway(playerId, at) : setPlanAway(sessionId, playerId, at)));
      const who = people.get(playerId)?.name ?? 'They';
      toast.success(at === null ? `${who} is back in the swaps` : `${who} is out of the swaps from the next game`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    }
  }

  if (!plan || !day) {
    if (role !== 'organiser') return null;
    return (
      <>
        <section aria-label="Day plan" className="rounded-3xl bg-white border border-dashed border-gray-300 p-4">
          <p className="text-[15px] font-bold text-ink">Plan the day</p>
          <p className="mt-0.5 text-[13px] leading-snug text-gray-600">
            Games back to back until the booking ends, and swaps every few minutes so everyone gets the same time and a turn in goal.
          </p>
          <button onClick={() => setSetting(true)} className="press mt-3 w-full min-h-12 rounded-2xl bg-white border border-gray-300 text-[15px] font-bold text-ink hover:border-ink">
            Plan the day
          </button>
        </section>
        {setting && <PlanSetupSheet sessionId={sessionId} lineup={lineup} gameMinutes={clock?.timer.minutes ?? 7} onSaved={onLineup} onClose={() => setSetting(false)} />}
      </>
    );
  }

  const per = day.sides.map((t) => day.fixtures.filter((f) => f.teamA === t || f.teamB === t).length);
  const from = clockAt(lineup.kickoff, 0);
  const to = clockAt(lineup.kickoff, plan.pitchMinutes);
  const canAway = (side: Side) => role === 'organiser' || side === myTeam;

  return (
    <>
      {live && state ? (
        <DayPlanLive
          day={day}
          plan={plan}
          live={state}
          gamesDone={lineup.games.length}
          look={look}
          people={people}
          myTeam={myTeam}
          clockMinutes={clock?.timer.minutes ?? null}
          onSetClock={
            role === 'organiser'
              ? async (minutes) => {
                  try {
                    await setTimer(sessionId, { minutes });
                    onClockChanged?.();
                    toast.success(`Timer set to ${minutes} min`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'The timer didn’t change. Try again.');
                  }
                }
              : undefined
          }
          onOpen={() => setOpen(true)}
        />
      ) : (
        <section aria-label="Day plan" className="rounded-3xl bg-ink turf-stripes p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white/60">Day plan</p>
              <p className="mt-0.5 font-display text-[22px] leading-tight font-extrabold tabular-nums">
                {day.fixtures.length} games{from && to && <span className="block text-[15px] text-white/70">{from} to {to}</span>}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-white/75">
                {day.sides.length > 2 && `Each team plays ${Math.min(...per) === Math.max(...per) ? per[0] : `${Math.min(...per)}–${Math.max(...per)}`} · `}
                {plan.gameMinutes} min games · {plan.onPitch} on the pitch
                {plan.swapMinutes ? ` · swaps every ${plan.swapMinutes} min` : ''}
              </p>
            </div>
            {role === 'organiser' && (
              <button onClick={() => setSetting(true)} className="press shrink-0 -mr-1 min-h-11 px-3 rounded-xl text-[13px] font-bold text-volt-300 hover:bg-white/10">
                Change
              </button>
            )}
          </div>
          <button onClick={() => setOpen(true)} className="press mt-3 w-full min-h-12 rounded-2xl bg-white text-ink text-[15px] font-bold hover:bg-chalk">
            See the games and swaps
          </button>
        </section>
      )}

      {open && (
        <WholePlanSheet
          day={day}
          plan={plan}
          live={live ? state : null}
          gamesDone={lineup.games.length}
          results={lineup.games}
          look={look}
          people={people}
          myTeam={myTeam}
          canAway={lineup.scoresOpen ? canAway : undefined}
          onAway={lineup.scoresOpen ? away : undefined}
          onEdit={
            role === 'organiser'
              ? () => {
                  setOpen(false);
                  setSetting(true);
                }
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      )}
      {setting && <PlanSetupSheet sessionId={sessionId} lineup={lineup} gameMinutes={plan.gameMinutes} onSaved={onLineup} onClose={() => setSetting(false)} />}
    </>
  );
}
