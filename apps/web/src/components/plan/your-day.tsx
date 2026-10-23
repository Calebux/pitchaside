'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameTimer } from '@pitchaside/shared';
import { getGameLineup, getGameTimer, type GameLineup } from '@/lib/player';
import { buildDay, clockAt, liveDay, spellAt, type Spell } from '@/lib/match-plan';
import { LiveDot } from '@/components/motion';
import { Swatch } from '@/components/game/teams-step';
import { teamName } from '@/lib/teams';
import { WholePlanSheet, usePeople, type PlanLook } from './plan-view';

/** "7:05–7:15" for a run of spells, by the plan's times. */
function runs(spells: Spell[], start: number, pick: (s: Spell) => boolean, at: (m: number) => string) {
  const out: string[] = [];
  let from: number | null = null;
  let to = 0;
  for (const s of spells) {
    if (pick(s)) {
      if (from === null) from = start + s.start;
      to = start + s.start + s.minutes;
    } else if (from !== null) {
      out.push(`${at(from)}–${at(to)}`);
      from = null;
    }
  }
  if (from !== null) out.push(`${at(from)}–${at(to)}`);
  return out;
}

/**
 * A player's own day from the plan: their team's games with times, when they sit out and when
 * they're in goal, and their minutes. On match day it follows the game on now. Nothing shows
 * without a plan; with one but no team yet, it says the games come once they're on a team.
 */
export function YourDay({ sessionId, live = false }: { sessionId: string; live?: boolean }) {
  const [lineup, setLineup] = useState<GameLineup | null>(null);
  const [clock, setClock] = useState<{ timer: GameTimer; offset: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const load = () => {
      getGameLineup(sessionId).then(setLineup).catch(() => undefined);
      if (live) getGameTimer(sessionId).then((t) => setClock({ timer: t, offset: Date.parse(t.now) - Date.now() })).catch(() => undefined);
    };
    load();
    if (!live) return;
    // Games and the clock change from the organiser's phone: look again while it's being watched.
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), 30_000);
    const tick = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [sessionId, live]);

  const people = usePeople(lineup?.squad ?? []);
  const plan = lineup?.plan ?? null;
  const day = useMemo(
    () => (lineup && plan ? buildDay({ plan, teamCount: lineup.teamCount, date: lineup.date, squad: lineup.squad }) : null),
    [lineup, plan],
  );
  if (!lineup || !plan || !day) return null;

  const look: PlanLook = { captains: lineup.captains, bibs: lineup.bibs, kickoff: lineup.kickoff };
  const at = (m: number) => clockAt(lineup.kickoff, m) ?? `${Math.round(m)}′`;
  const done = lineup.live?.games.length ?? 0;
  const state = live ? liveDay(day, plan, done, clock?.timer ?? null, now + (clock?.offset ?? 0), lineup.date, lineup.kickoff) : null;
  const me = lineup.squad.find((m) => m.me);
  const team = lineup.myTeam;
  const rota = team ? day.rotas[team] : undefined;
  const mine = me?.id && rota ? rota.minutes[me.id] : undefined;

  const sheet = open && (
    <WholePlanSheet
      day={day}
      plan={plan}
      live={state}
      gamesDone={done}
      results={lineup.live?.games ?? []}
      look={look}
      people={people}
      myTeam={team}
      onClose={() => setOpen(false)}
    />
  );

  if (!team || !rota || !me?.id || !mine) {
    return (
      <section aria-label="Your day" className="rounded-3xl bg-white border border-gray-100 shadow-card p-4">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Your day</p>
        <p className="mt-1 text-[14px] text-ink">
          {day.fixtures.length} games planned{look.kickoff ? `, ${at(0)} to ${at(plan.pitchMinutes)}` : ''}.{' '}
          {/* Marked as not here, they're left out of the squad (and the swaps). */}
          {!me ? 'You’re marked as not here today, so you’re not in the swaps. Tell the organiser if you’ve come.' : 'Your games and swaps show here once you’re on a team.'}
        </p>
        <button onClick={() => setOpen(true)} className="press mt-2 min-h-11 px-1 text-[14px] font-bold text-pitch-700">
          See all the games
        </button>
        {sheet}
      </section>
    );
  }

  const myId = me.id;
  const gone = plan.away?.[myId];
  // What they're doing right now, while a game of theirs is on.
  const nowGame = state?.playing ? rota.games.find((g) => g.fixture.n === state.playing!.n) : undefined;
  const nowSpell = nowGame && state?.elapsed != null ? spellAt(nowGame.spells, state.elapsed) : null;
  const nowLine = nowSpell
    ? nowSpell.spell.keeper === myId
      ? 'You’re in goal now'
      : nowSpell.spell.off.includes(myId)
        ? 'You’re sitting out now'
        : nowSpell.spell.on.includes(myId)
          ? 'You’re on now'
          : null
    : null;

  return (
    <section aria-label="Your day" className="rounded-3xl bg-white border border-gray-100 shadow-card overflow-hidden">
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.12em] text-gray-500">
          Your day ·
          <Swatch team={team} bibs={lineup.bibs} className="w-3 h-3 rounded-sm" />
          <span className="normal-case tracking-normal text-ink truncate">{teamName(team, lineup.captains, lineup.bibs)}</span>
        </p>
        <p className="mt-1 font-display text-[22px] leading-tight font-extrabold text-ink tabular-nums">
          {rota.games.length} game{rota.games.length === 1 ? '' : 's'} · {mine.played} min on
        </p>
        <p className="text-[13px] text-gray-600">
          {mine.inGoal ? `${mine.inGoal} min in goal` : 'No time in goal'}
          {mine.off ? ` · ${mine.off} min sitting out` : ''}
        </p>
        {gone !== undefined && (
          <p className="mt-2 rounded-2xl bg-chalk px-3 py-2 text-[13px] text-ink">You’re marked as gone early: you’re out of the swaps from then on.</p>
        )}
        {nowLine && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-volt-300 px-3 py-1.5 text-[13px] font-bold text-ink" role="status">
            <LiveDot className="bg-ink" /> {nowLine}
          </p>
        )}
      </div>
      <ol className="border-t border-gray-100 divide-y divide-gray-100">
        {rota.games.map(({ fixture: f, spells }) => {
          const other = f.teamA === team ? f.teamB : f.teamA;
          const t = state?.ahead.games.find((g) => g.n === f.n) ?? f;
          const keep = runs(spells, t.start, (s) => s.keeper === myId, at);
          const sit = runs(spells, t.start, (s) => s.off.includes(myId), at);
          const played = f.n < done;
          const on = state?.playing?.n === f.n;
          return (
            <li key={f.n} className={`flex gap-3 px-4 py-3 ${on ? 'bg-volt-300/25' : ''} ${played ? 'opacity-60' : ''}`}>
              <span className="w-14 shrink-0 text-[13px] font-bold text-ink tabular-nums">{look.kickoff ? at(t.start) : `Game ${f.n + 1}`}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink min-w-0">
                  <span className="shrink-0 text-gray-500 font-semibold">v</span>
                  <Swatch team={other} bibs={lineup.bibs} className="w-3 h-3 rounded-sm" />
                  <span className="truncate">{teamName(other, lineup.captains, lineup.bibs)}</span>
                  {on && (
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[11px]">
                      <LiveDot /> On now
                    </span>
                  )}
                  {played && <span className="ml-auto shrink-0 text-[11px] text-gray-500">Played</span>}
                </span>
                <span className="block text-[12px] leading-snug text-gray-600">
                  {keep.length > 0 && (
                    <>
                      <span aria-hidden>🧤 </span>In goal {keep.join(', ')}
                    </>
                  )}
                  {keep.length > 0 && sit.length > 0 && ' · '}
                  {sit.length > 0 && `Sit out ${sit.join(', ')}`}
                  {!keep.length && !sit.length && (spells.some((s) => s.on.includes(myId)) ? 'On the whole game' : 'Not playing')}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="px-4 pb-3 pt-1">
        <button onClick={() => setOpen(true)} className="press min-h-11 px-1 text-[14px] font-bold text-pitch-700">
          See the whole plan
        </button>
        {(state?.ahead.late ?? 0) > 0 && <p className="text-[12px] text-gray-500">Running {state!.ahead.late} min late: times are moved on.</p>}
        {look.kickoff && (state?.ahead.late ?? 0) === 0 && <p className="text-[12px] text-gray-500">Times are the plan’s; they move if the day runs late.</p>}
      </div>
      {sheet}
    </section>
  );
}
