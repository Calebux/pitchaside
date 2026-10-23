'use client';

import { useId, useMemo, useState } from 'react';
import type { MatchPlan } from '@pitchaside/shared';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { BallSpinner } from '@/components/skeleton';
import { btnPrimary } from '@/components/buttons';
import { savePlan, type Lineup, type TeamKey } from '@/lib/api';
import { teamName } from '@/lib/teams';
import { buildDay, clockAt } from '@/lib/match-plan';

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
  const start: Settings = lineup.plan ?? lineup.lastPlan ?? { pitchMinutes: 60, gameMinutes, onPitch: 5, swapMinutes: 0 };
  const [s, setS] = useState<Settings>({
    pitchMinutes: start.pitchMinutes,
    gameMinutes: start.gameMinutes,
    onPitch: start.onPitch,
    swapMinutes: start.swapMinutes,
  });
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
  if (sides.length > 2 && fewest !== most) notes.push(`Some teams play ${most} games and some ${fewest}: there isn’t time for everyone to play the same number.`);
  if (sides.length > 2 && day.fixtures.length < (sides.length * (sides.length - 1)) / 2) notes.push('Not every team plays every other team: the booking is too short.');
  if (last && last.minutes !== s.gameMinutes) notes.push(`The last game is ${last.minutes} min, to use the whole booking.`);
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
      setError(err instanceof Error ? err.message : 'The plan didn’t save. Try again.');
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
          <button onClick={() => save(s)} disabled={!!saving || s.gameMinutes > s.pitchMinutes} className={`${btnPrimary} w-full`}>
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
        <Picker
          id={`${titleId}-game`}
          label="Each game lasts"
          hint="Minutes. The timer is set to this too."
          value={s.gameMinutes}
          quick={[5, 7, 10, 12, 15]}
          min={1}
          max={Math.min(60, s.pitchMinutes)}
          unit="minutes"
          onChange={(v) => set({ gameMinutes: v })}
        />
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
          Players say in their app if they’re happy in goal. Running late? The last game gets shorter so you still finish on time.
        </p>
        {error && (
          <p role="alert" className="text-sm text-kit-600">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
