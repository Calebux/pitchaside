'use client';

import { useId, useMemo, useState } from 'react';
import type { MatchPlan } from '@pitchaside/shared';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { BallSpinner } from '@/components/skeleton';
import { btnPrimary } from '@/components/buttons';
import { savePlan, type Lineup, type TeamKey } from '@/lib/api';
import { teamName } from '@/lib/teams';
import { useToast } from '@/components/toast';
import { MAX_DRAW, buildDay, clockAt } from '@/lib/match-plan';
import { WS_DEFAULTS } from '@/lib/winner-stays';

type Settings = Omit<MatchPlan, 'away'>;

/** A number picked with one tap from the usual ones, or − and + for the rest. */
function Picker({
  id,
  label,
  hint,
  value,
  quick,
  step = 1,
  min,
  max,
  unit,
  format = (v) => String(v),
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  quick: number[];
  step?: number;
  min: number;
  max: number;
  unit: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const chip = (on: boolean) =>
    `press shrink-0 h-11 min-w-11 px-3 rounded-xl text-[14px] font-bold tabular-nums border ${
      on ? 'bg-ink border-ink text-volt-300' : 'bg-white border-gray-200 text-ink hover:border-ink'
    }`;
  return (
    <div>
      <p id={id} className="text-[13px] font-bold text-ink">
        {label}
      </p>
      {hint && <p className="text-[12px] leading-snug text-gray-500">{hint}</p>}
      <div className="mt-2 flex items-center gap-1.5" role="group" aria-labelledby={id}>
        <button type="button" aria-label={`${step} ${unit} less`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className={`${chip(false)} w-11 px-0 text-lg disabled:opacity-40`}>
          −
        </button>
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quick.map((q) => (
            <button key={q} type="button" aria-pressed={value === q} onClick={() => onChange(q)} className={chip(value === q)}>
              {format(q)}
            </button>
          ))}
          {!quick.includes(value) && (
            <span className={`${chip(true)} inline-flex items-center`} aria-live="polite">
              {format(value)}
            </span>
          )}
        </div>
        <button type="button" aria-label={`${step} ${unit} more`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className={`${chip(false)} w-11 px-0 text-lg disabled:opacity-40`}>
          +
        </button>
      </div>
    </div>
  );
}

const hours = (m: number) => (m % 60 === 0 ? `${m / 60} hr` : m > 60 ? `${Math.floor(m / 60)}h ${m % 60}` : `${m} min`);

/**
 * Setting up the day: how long the pitch is booked, how long each game is, how many are on the
 * pitch, and how often to swap. A preview says what that makes before it's saved.
 */
export function PlanSetupSheet({
  sessionId,
  lineup,
  gameMinutes,
  onSaved,
  onClose,
}: {
  sessionId: string;
  lineup: Lineup;
  /** Today's timer length: the game length to start from with no plan yet. */
  gameMinutes: number;
  onSaved: (l: Lineup) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const start: Settings = lineup.plan ?? lineup.lastPlan ?? { pitchMinutes: 60, gameMinutes, onPitch: 5, swapMinutes: 0 };
  const [s, setS] = useState<Settings>(() => ({
    // A new plan gets its own draw, so the day doesn't start with the same sides every week
    // (last week's plan is only a starting point for the numbers). Changing a plan keeps its draw.
    draw: lineup.plan ? lineup.plan.draw : 1 + Math.floor(Math.random() * MAX_DRAW),
    format: start.format ?? 'schedule',
    pitchMinutes: start.pitchMinutes,
    gameMinutes: start.gameMinutes,
    onPitch: start.onPitch,
    swapMinutes: start.swapMinutes,
    firstMinutes: start.firstMinutes ?? WS_DEFAULTS.firstMinutes,
    firstTo: start.firstTo ?? WS_DEFAULTS.firstTo,
    twoAndOff: start.twoAndOff ?? WS_DEFAULTS.twoAndOff,
  }));
  const ws = s.format === 'winner_stays';
  // Winner stays needs someone waiting: not with 2 teams.
  const wsPossible = lineup.teamCount >= 3;
  // Once a score is in, the day's format is set.
  const formatLocked = !!lineup.plan && lineup.locked;
  const [saving, setSaving] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Settings>) => setS((x) => ({ ...x, ...patch }));

  const day = useMemo(() => buildDay({ plan: s, teamCount: lineup.teamCount, date: lineup.date, squad: lineup.squad }), [s, lineup]);
  const sides = day.sides;
  const per = sides.map((t) => day.fixtures.filter((f) => f.teamA === t || f.teamB === t).length);
  const fewest = Math.min(...per);
  const most = Math.max(...per);
  const last = day.fixtures[day.fixtures.length - 1];
  const sizes = sides.map((t) => ({ t, n: lineup.squad.filter((m) => m.team === t).length }));
  const ends = clockAt(lineup.kickoff, s.pitchMinutes);
  const from = clockAt(lineup.kickoff, 0);

  // Things worth knowing before saving, said plainly.
  const notes: string[] = [];
  if (ws) {
    if (sides.length === 3) notes.push('With 3 teams, after a draw one of the two going off comes straight back on: only one team is waiting.');
    if (sides.length >= 5) notes.push(`With ${sides.length} teams there may not be time for every team to play every other.`);
  }
  if (!ws && sides.length > 2 && fewest !== most) notes.push(`Some teams play ${most} games and some ${fewest}: there isn’t time for everyone to play the same number.`);
  if (!ws && sides.length > 2 && day.fixtures.length < (sides.length * (sides.length - 1)) / 2) notes.push('Not every team plays every other team: the booking is too short.');
  if (!ws && last && last.minutes !== s.gameMinutes) notes.push(`The last game is ${last.minutes} min, to use the whole booking.`);
  const picked = sizes.filter((x) => x.n > 0);
  if (!picked.length) notes.push('Pick the teams to see each player’s swaps.');
  for (const { t, n } of picked) if (n < s.onPitch) notes.push(`${teamName(t as TeamKey, lineup.captains, lineup.bibs)} has ${n}, fewer than ${s.onPitch}: nobody sits out.`);
  if (picked.length > 1 && new Set(picked.map((x) => x.n)).size > 1) notes.push('The teams aren’t the same size, so players on bigger teams sit out more.');

  async function save(plan: Settings | null) {
    setSaving(plan ? 'save' : 'remove');
    setError(null);
    try {
      onSaved(await savePlan(sessionId, plan));
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The plan didn’t save. Try again.';
      setError(message);
      toast.error(message);
      setSaving(null);
    }
  }

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        <div className="space-y-2">
          {/* Next to the button, so a failed save is never off-screen */}
          {error && (
            <p role="alert" className="flex items-start gap-1.5 px-1 text-[13px] leading-snug font-semibold text-kit-600">
              <svg className="w-4 h-4 mt-px shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3.5h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              {error}
            </p>
          )}
          <button
            onClick={() => save(ws ? s : { format: 'schedule', pitchMinutes: s.pitchMinutes, gameMinutes: s.gameMinutes, onPitch: s.onPitch, swapMinutes: s.swapMinutes, draw: s.draw })}
            disabled={!!saving || s.gameMinutes > s.pitchMinutes || (ws && !wsPossible)} className={`${btnPrimary} w-full`}>
            {saving === 'save' && <BallSpinner />}
            {lineup.plan ? 'Save the changes' : 'Save the plan'}
          </button>
          {lineup.plan && (
            <button onClick={() => save(null)} disabled={!!saving} className="press w-full min-h-11 rounded-2xl text-[14px] font-bold text-kit-600 hover:bg-kit-500/10 inline-flex items-center justify-center gap-2">
              {saving === 'remove' && <BallSpinner className="w-4 h-4" />}
              Remove the plan
            </button>
          )}
        </div>
      }
    >
      <SheetTitle
        id={titleId}
        title={lineup.plan ? 'Change the plan' : 'Plan the day'}
        sub="Games back to back until the booking ends, and swaps so everyone gets the same time on the pitch."
        onClose={onClose}
      />
      <div className="mt-5 space-y-5">
        {/* How the day is played: the rest of the sheet follows it */}
        <div>
          <p id={`${titleId}-format`} className="text-[13px] font-bold text-ink">
            How do you play today?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={`${titleId}-format`}>
            {(
              [
                ['schedule', 'Everyone plays everyone', 'Set games and times, worked out now'],
                ['winner_stays', 'Winner stays', 'Who comes on is worked out from each result'],
              ] as const
            ).map(([value, label, sub]) => {
              const on = s.format === value;
              const off = (value === 'winner_stays' && !wsPossible) || (formatLocked && !on);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={off}
                  onClick={() => set({ format: value })}
                  className={`press min-h-[88px] p-3 rounded-2xl border text-left transition-colors disabled:opacity-45 ${
                    on ? 'bg-ink border-ink text-white' : 'bg-white border-gray-200 text-ink hover:border-ink'
                  }`}
                >
                  <span className="block text-[14px] font-bold leading-tight">{label}</span>
                  <span className={`block mt-1 text-[12px] leading-snug ${on ? 'text-white/70' : 'text-gray-500'}`}>{sub}</span>
                </button>
              );
            })}
          </div>
          {!wsPossible && <p className="mt-1.5 px-1 text-[12px] text-gray-500">Winner stays needs 3 teams or more, so someone is waiting.</p>}
          {formatLocked && <p className="mt-1.5 px-1 text-[12px] text-gray-500">The day has started, so the format stays as it is.</p>}
        </div>
        <Picker
          id={`${titleId}-pitch`}
          label="The pitch is booked for"
          hint={from && ends ? `${from} to ${ends}` : 'From kick-off'}
          value={s.pitchMinutes}
          quick={[60, 90, 120]}
          step={15}
          min={15}
          max={300}
          unit="minutes"
          format={hours}
          onChange={(v) => set({ pitchMinutes: v, gameMinutes: Math.min(s.gameMinutes, v) })}
        />
        {ws ? (
          <>
            <Picker
              id={`${titleId}-first`}
              label="First-round games last"
              hint="Minutes, until every team has played once. Winner stays, loser off, whatever the score; level, both off."
              value={s.firstMinutes ?? WS_DEFAULTS.firstMinutes}
              quick={[5, 7, 10, 15]}
              min={1}
              max={Math.min(60, s.pitchMinutes)}
              unit="minutes"
              onChange={(v) => set({ firstMinutes: v })}
            />
            <Picker
              id={`${titleId}-to`}
              label="After that, a team goes off when it concedes"
              hint="Goals."
              value={s.firstTo ?? WS_DEFAULTS.firstTo}
              quick={[1, 2, 3]}
              min={1}
              max={5}
              unit="goals"
              onChange={(v) => set({ firstTo: v })}
            />
            <Picker
              id={`${titleId}-limit`}
              label="Or when time’s up"
              hint="Minutes. The team ahead wins; level, both go off."
              value={s.gameMinutes}
              quick={[5, 8, 10, 15]}
              min={1}
              max={Math.min(60, s.pitchMinutes)}
              unit="minutes"
              onChange={(v) => set({ gameMinutes: v })}
            />
            <label className="flex items-start gap-3 rounded-2xl bg-white border border-gray-200 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={s.twoAndOff !== false}
                onChange={(e) => set({ twoAndOff: e.target.checked })}
                className="mt-0.5 w-5 h-5 shrink-0 accent-pitch-700"
              />
              <span>
                <span className="block text-[14px] font-bold text-ink">Two wins in a row and off</span>
                <span className="block text-[12px] leading-snug text-gray-500">A team that wins twice goes off too, so one strong team can’t stay on all day.</span>
              </span>
            </label>
          </>
        ) : (
          <Picker
            id={`${titleId}-game`}
            label="Each game lasts"
            hint="Minutes. The timer is set to this too."
            value={s.gameMinutes}
            quick={[5, 7, 10, 15]}
            min={1}
            max={Math.min(60, s.pitchMinutes)}
            unit="minutes"
            onChange={(v) => set({ gameMinutes: v })}
          />
        )}
        <Picker
          id={`${titleId}-on`}
          label="Players on the pitch per team"
          hint="Keeper included."
          value={s.onPitch}
          quick={[5, 6, 7]}
          min={2}
          max={11}
          unit="players"
          onChange={(v) => set({ onPitch: v })}
        />
        <Picker
          id={`${titleId}-swap`}
          label="Swap players every"
          hint="Minutes. Who sits out and who goes in goal changes each time, so it’s fair."
          value={s.swapMinutes}
          quick={[0, 3, 5, 10]}
          min={0}
          max={30}
          unit="minutes"
          format={(v) => (v ? String(v) : 'Never')}
          onChange={(v) => set({ swapMinutes: v })}
        />

        {/* What that makes */}
        <div className="rounded-3xl bg-chalk p-4" aria-live="polite">
          {ws ? (
            <>
              <p className="font-display text-[22px] leading-tight font-extrabold text-ink tabular-nums">
                Winner stays<span className="text-gray-500"> · at least {Math.max(1, Math.floor(s.pitchMinutes / Math.max(s.gameMinutes, s.firstMinutes ?? 10)))} games</span>
              </p>
              <p className="mt-1 text-[13px] leading-snug text-gray-600">
                The app says who comes on after each saved score: the team that has played least, then one the team staying on hasn’t played yet.
                {ends ? ` Last whistle at ${ends}.` : ''}
              </p>
            </>
          ) : (
          <>
          <p className="font-display text-[22px] leading-tight font-extrabold text-ink tabular-nums">
            {day.fixtures.length} game{day.fixtures.length === 1 ? '' : 's'}
            {sides.length > 2 && <span className="text-gray-500"> · each team plays {fewest === most ? most : `${fewest}–${most}`}</span>}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-gray-600">
            {sides.length > 2 && day.fixtures.length > (sides.length * (sides.length - 1)) / 2
              ? 'Everyone plays everyone, then round again until time’s up.'
              : sides.length > 2
                ? 'Each game is a different pair of teams.'
                : 'The same two teams, game after game.'}
            {ends ? ` Last whistle at ${ends}.` : ''}
          </p>
          </>
          )}
          {notes.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {notes.map((n) => (
                <li key={n} className="flex gap-2 text-[13px] leading-snug text-ink">
                  <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-kit-500" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[12px] leading-snug text-gray-500">
          Players say in their app if they’re happy in goal.{' '}
          {ws ? 'The last game ends when the booking does, whatever the score.' : 'Running late? The last game gets shorter so you still finish on time.'}
        </p>
      </div>
    </Sheet>
  );
}
