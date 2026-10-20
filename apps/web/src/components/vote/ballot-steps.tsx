'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { BallSpinner } from '@/components/skeleton';
import { BibShirt } from '@/components/bib-shirt';
import { Avatar } from '@/components/ratings';
import { buzz, stagger } from '@/components/motion';
import type { Ballot, TeamKey, VoteCategory } from '@/lib/api';
import { TEAMS, bibFill, bibOf, bibTint, teamName } from '@/lib/teams';

export type Picks = Partial<Record<VoteCategory, string | string[]>>;
type Player = Ballot['squad'][number];
type Step = 'potm' | 'vii' | 'awards';

const short = (p: Player) => `${p.nickname || p.firstName} ${p.lastName.charAt(0)}.`;
const initials = (p: Player) => `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
const STEP_NAME: Record<Step, string> = { potm: 'Player of the Match', vii: 'Best VII', awards: 'Awards' };
const full = (p: Player) => `${p.firstName} ${p.lastName}`;

/**
 * The post-match ballot in three short steps, one button each: Player of the Match and the best on
 * your team; your Best VII of the Day (six starters and a sub, some from other teams); then up to
 * three awards, each optional. Everyone is grouped by side, your team first.
 */
export function BallotSteps({
  ballot,
  me,
  firstName,
  picks,
  onPicks,
  onSubmit,
  busy,
  error,
}: {
  ballot: Ballot;
  me: string;
  firstName: string;
  picks: Picks;
  onPicks: (p: Picks) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const sheetId = useId();
  const steps: Step[] = ['potm', ...(ballot.vii ? (['vii'] as const) : []), 'awards'];
  const [step, setStep] = useState<Step>('potm');
  const [awardOpen, setAwardOpen] = useState<VoteCategory | null>(null);
  const at = steps.indexOf(step);

  const others = ballot.squad.filter((p) => p.id !== me);
  const myTeam = ballot.squad.find((p) => p.id === me)?.team ?? null;
  const keys = [...new Set(others.map((p) => p.team))].sort((x, y) =>
    x === myTeam ? -1 : y === myTeam ? 1 : x === null ? 1 : y === null ? -1 : x.localeCompare(y),
  );
  const sides = keys.map((key) => ({
    key,
    mine: !!key && key === myTeam,
    label: key ? (teamName(key, ballot.captains, ballot.bibs) === bibOf(key, ballot.bibs).label ? bibOf(key, ballot.bibs).label : `${bibOf(key, ballot.bibs).label} · ${teamName(key, ballot.captains, ballot.bibs)}`) : keys.length > 1 ? 'No team' : 'Who played',
    players: others.filter((p) => p.team === key),
  }));
  const byId = (id: unknown) => others.find((p) => p.id === id);
  const mates = myTeam && ballot.categories.some((c) => c.key === 'teammate') ? others.filter((p) => p.team === myTeam) : [];

  // Best VII: starters in the order picked, then the sub.
  const starters = (Array.isArray(picks.vii) ? picks.vii : []).filter((id) => byId(id));
  const sub = typeof picks.vii_sub === 'string' && byId(picks.vii_sub) ? picks.vii_sub : null;
  const seven = [...starters, ...(sub ? [sub] : [])];
  const fromElsewhere = seven.filter((id) => {
    const t = byId(id)?.team;
    return !!myTeam && !!t && t !== myTeam;
  }).length;
  const elsewhereAvailable = others.filter((p) => !!myTeam && p.team && p.team !== myTeam).length;
  const needElsewhere = ballot.vii ? Math.min(ballot.vii.minOtherTeams, elsewhereAvailable) : 0;
  const viiDone = !ballot.vii || (starters.length === ballot.vii.starters && !!sub && fromElsewhere >= needElsewhere);

  const awardKeys = ballot.awards.map((a) => a.key);
  const awardsPicked = awardKeys.filter((k) => typeof picks[k] === 'string' && byId(picks[k]));

  function togglePotm(id: string) {
    buzz(6);
    onPicks({ ...picks, potm: id });
  }
  function toggleMate(id: string) {
    buzz(6);
    onPicks({ ...picks, teammate: picks.teammate === id ? undefined : id });
  }
  function toggleSeven(id: string) {
    if (!ballot.vii) return;
    buzz(6);
    if (starters.includes(id)) onPicks({ ...picks, vii: starters.filter((x) => x !== id) });
    else if (sub === id) onPicks({ ...picks, vii_sub: undefined });
    else if (starters.length < ballot.vii.starters) onPicks({ ...picks, vii: [...starters, id] });
    else if (!sub) onPicks({ ...picks, vii_sub: id });
  }

  const step1Done = !!picks.potm && (!mates.length || !!picks.teammate);
  const nextLabel = (to: Step) => (to === 'vii' ? 'Next: your Best VII' : 'Next: awards');

  /** One player to tap, as their bib in their side's colour. `mark` shows when picked: a tick, or their Best VII spot. */
  const chip = (p: Player, selected: boolean, onTap: () => void, mark: string | null = null, disabled = false) => (
    <li key={p.id} className="min-w-0">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${p.nickname ? `${full(p)}, “${p.nickname}”` : full(p)}${p.team ? `, ${bibOf(p.team, ballot.bibs).label}` : ''}${mark && selected ? `, ${mark}` : ''}`}
        onClick={onTap}
        disabled={disabled && !selected}
        className={`press relative w-full flex flex-col items-center gap-1 min-h-[96px] px-1.5 pt-2.5 pb-2 rounded-2xl border-2 text-center transition-colors disabled:opacity-40 ${
          selected ? 'border-ink bg-volt-300 shadow-sticker' : 'border-gray-100 bg-white hover:border-gray-300'
        }`}
      >
        <BibShirt team={p.team} bibs={ballot.bibs} label={initials(p)} className="w-11 h-11" />
        <span className="w-full truncate text-[13px] font-bold text-ink leading-tight">{short(p)}</span>
        {selected && (
          <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-ink text-volt-300 text-[11px] font-extrabold leading-6 text-center animate-pop-in" aria-hidden>
            {mark ?? '✓'}
          </span>
        )}
      </button>
    </li>
  );

  const bySide = (render: (p: Player) => React.ReactNode, only?: (p: Player) => boolean) =>
    sides.map((side) => {
      const players = side.players.filter((p) => !only || only(p));
      if (!players.length) return null;
      return (
        <section key={side.key ?? 'all'} aria-label={side.label} className="mt-3.5">
          <h3 className="flex items-center gap-2 mb-1.5 text-[13px] font-bold text-gray-700">
            {side.key && <span className="w-3 h-3 rounded-sm shrink-0" style={bibFill(side.key as TeamKey, ballot.bibs)} aria-hidden />}
            {side.label}
            {side.mine && <span className="text-[11px] font-semibold text-gray-500">· your team</span>}
          </h3>
          <ul className="grid grid-cols-3 gap-2">{players.map(render)}</ul>
        </section>
      );
    });

  let button: { label: string; disabled: boolean; onClick: () => void };
  if (step === 'potm') {
    button = {
      label: !picks.potm ? 'Pick Player of the Match' : mates.length && !picks.teammate ? 'Pick the best on your team' : nextLabel(steps[at + 1]),
      disabled: !step1Done,
      onClick: () => setStep(steps[at + 1]),
    };
  } else if (step === 'vii') {
    const left = ballot.vii!.starters - starters.length + (sub ? 0 : 1);
    button = {
      label: left > 0 ? `Pick ${left} more` : fromElsewhere < needElsewhere ? `Pick ${needElsewhere} from other teams` : nextLabel('awards'),
      disabled: !viiDone,
      onClick: () => setStep('awards'),
    };
  } else {
    button = {
      label: awardsPicked.length ? `Send my vote · ${awardsPicked.length} award${awardsPicked.length === 1 ? '' : 's'}` : 'Send my vote',
      disabled: busy,
      onClick: onSubmit,
    };
  }

  return (
    // Room at the bottom so the last lines never sit under the pinned button.
    <div className="mt-6 pb-28">
      <div className="flex items-center justify-between min-h-11">
        {at > 0 ? (
          <button onClick={() => setStep(steps[at - 1])} className="press -ml-1 h-11 px-1 inline-flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-ink">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-[12px] font-bold text-gray-500 tabular-nums">
          Step {at + 1} of {steps.length}
        </span>
      </div>
      {/* Where they are in the vote: one segment per step, filled up to this one */}
      <ol className="mb-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === at ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full transition-colors ${i <= at ? 'bg-ink' : 'bg-gray-200'}`} aria-hidden />
            <span className={`mt-1 block truncate text-[11px] font-bold ${i === at ? 'text-ink' : 'text-gray-500'}`}>
              {STEP_NAME[s]}
              {i < at && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        ))}
      </ol>

      {step === 'potm' && (
        <>
          <h2 className="font-display text-2xl font-extrabold text-ink">Player of the Match</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Hey <span className="font-bold text-ink">{firstName}</span>, who was best on the pitch? One pick.
          </p>
          <div role="radiogroup" aria-label="Player of the Match">
            {bySide((p) => chip(p, picks.potm === p.id, () => togglePotm(p.id)))}
          </div>
          {mates.length > 0 && myTeam && (
            <section className="mt-7" aria-labelledby="best-mate">
              <h2 id="best-mate" className="font-display text-xl font-extrabold text-ink">
                Best on your team
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                One of your {bibOf(myTeam, ballot.bibs).label}
                {ballot.captains[myTeam] ? ` (Team ${ballot.captains[myTeam]})` : ''} teammates.
              </p>
              <ul className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="best-mate">
                {mates.map((p) => chip(p, picks.teammate === p.id, () => toggleMate(p.id)))}
              </ul>
            </section>
          )}
        </>
      )}

      {step === 'vii' && ballot.vii && (
        <>
          <h2 className="font-display text-2xl font-extrabold text-ink">Your Best VII</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            The seven best today: {ballot.vii.starters} starters, then a sub.
            {needElsewhere > 0 && ` At least ${needElsewhere} from other teams.`}
          </p>
          {/* The seven so far, on a pitch: tap one to take them off */}
          <div className="relative mt-3 rounded-3xl bg-pitch-700 turf-stripes border-[3px] border-ink overflow-hidden px-2 pt-4 pb-3">
            <span className="absolute left-1/2 top-[42%] w-20 h-20 -ml-10 -mt-10 rounded-full border-2 border-white/25" aria-hidden />
            <span className="absolute inset-x-0 top-[42%] h-0.5 bg-white/25" aria-hidden />
            <ol className="relative grid grid-cols-3 gap-y-3 gap-x-1" aria-label="Starters">
              {Array.from({ length: ballot.vii.starters }, (_, i) => {
                const p = byId(starters[i]);
                return (
                  <li key={i} className="min-w-0">
                    <button
                      onClick={() => p && toggleSeven(p.id)}
                      disabled={!p}
                      aria-label={p ? `Starter ${i + 1}: ${full(p)}. Tap to take off` : `Starter ${i + 1}: empty`}
                      className="press w-full min-h-[76px] flex flex-col items-center gap-1 text-white"
                    >
                      {p ? (
                        <span className="animate-pop-in">
                          <BibShirt team={p.team} bibs={ballot.bibs} label={initials(p)} className="w-12 h-12" />
                        </span>
                      ) : (
                        <BibShirt empty label={String(i + 1)} className="w-12 h-12 text-white/60" />
                      )}
                      <span className={`max-w-full truncate px-1.5 rounded-md text-[11px] font-bold ${p ? 'bg-ink' : 'text-white/60'}`}>{p ? short(p) : 'Empty'}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="relative mt-3 flex items-center gap-2 rounded-2xl bg-ink/40 px-2 py-1.5">
              <span className="shrink-0 text-[11px] font-extrabold text-white/80">SUB</span>
              <button
                onClick={() => sub && toggleSeven(sub)}
                disabled={!sub}
                aria-label={sub ? `Sub: ${full(byId(sub)!)}. Tap to take off` : 'Sub: empty'}
                className="press flex-1 min-h-11 flex items-center gap-2 text-left text-white"
              >
                {sub ? (
                  <>
                    <BibShirt team={byId(sub)!.team} bibs={ballot.bibs} label={initials(byId(sub)!)} className="w-9 h-9" />
                    <span className="truncate text-[13px] font-bold">{short(byId(sub)!)}</span>
                  </>
                ) : (
                  <>
                    <BibShirt empty label="7" className="w-9 h-9 text-white/60" />
                    <span className="text-[12px] font-bold text-white/60">{starters.length < ballot.vii.starters ? 'After the starters' : 'Pick your sub'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[13px] font-semibold text-gray-600 tabular-nums" aria-live="polite">
            {seven.length} of {ballot.vii.starters + ballot.vii.subs} picked
            {needElsewhere > 0 && (
              <span className={fromElsewhere >= needElsewhere ? 'text-pitch-700' : 'text-amber-700'}>
                {' '}
                · {fromElsewhere} from other teams{fromElsewhere < needElsewhere ? ` (${needElsewhere} needed)` : ''}
              </span>
            )}
          </p>
          {bySide((p) => {
            const slot = starters.indexOf(p.id);
            const isSub = sub === p.id;
            return chip(p, slot >= 0 || isSub, () => toggleSeven(p.id), isSub ? 'Sub' : String(slot + 1), seven.length >= ballot.vii!.starters + 1);
          })}
        </>
      )}

      {step === 'awards' && (
        <>
          <h2 className="font-display text-2xl font-extrabold text-ink">Awards</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Optional. Pick up to {ballot.maxAwards} you saw clearly; skip the rest.
          </p>
          <p className="mt-2 text-[13px] font-semibold text-gray-600 tabular-nums" aria-live="polite">
            {awardsPicked.length} of {ballot.maxAwards} picked
          </p>
          <ul className="mt-2 bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 overflow-hidden">
            {ballot.awards.map((a, i) => {
              const who = typeof picks[a.key] === 'string' ? byId(picks[a.key]) : undefined;
              const full3 = awardsPicked.length >= ballot.maxAwards && !who;
              return (
                <li key={a.key} className="animate-rise" style={stagger(i, 25, 0)}>
                  <button
                    onClick={() => setAwardOpen(a.key)}
                    disabled={full3}
                    className="press w-full flex items-center gap-3 px-4 min-h-16 py-2.5 text-left hover:bg-chalk/70 disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[15px] font-bold ${full3 ? 'text-gray-400' : 'text-ink'}`}>{a.title}</span>
                      <span className="block text-[12px] leading-snug text-gray-500">{a.hint}</span>
                    </span>
                    {who ? (
                      <span className="shrink-0 inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full bg-volt-300 text-[13px] font-bold text-ink">
                        <Avatar name={full(who)} photoKey={who.photoKey} className="w-6 h-6 text-[9px]" />
                        {short(who)}
                      </span>
                    ) : (
                      <span className={`shrink-0 text-[13px] font-bold ${full3 ? 'text-gray-300' : 'text-pitch-700'}`}>Pick</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-gray-500">You can&apos;t pick yourself. The winners show when the vote closes.</p>
      {error && <div className="mt-3 bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white to-transparent">
        <button
          onClick={() => {
            button.onClick();
            if (step !== 'awards') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={button.disabled}
          className="w-full max-w-md mx-auto flex items-center justify-center gap-2 h-14 bg-ink text-volt-300 text-[15px] font-bold rounded-2xl shadow-lift hover:bg-pitch-900 transition-colors disabled:opacity-50"
        >
          {busy && step === 'awards' && <BallSpinner />}
          {button.label}
        </button>
      </div>

      {awardOpen && (() => {
        const a = ballot.awards.find((x) => x.key === awardOpen)!;
        const current = picks[awardOpen];
        return (
          <Sheet titleId={sheetId} onClose={() => setAwardOpen(null)} align="left">
            <SheetTitle id={sheetId} title={a.title} sub={a.hint} onClose={() => setAwardOpen(null)} />
            <div className="pb-1">
              {bySide((p) =>
                chip(p, current === p.id, () => {
                  buzz(6);
                  onPicks({ ...picks, [awardOpen]: current === p.id ? undefined : p.id });
                  setAwardOpen(null);
                }),
              )}
            </div>
            {current && (
              <button
                onClick={() => {
                  onPicks({ ...picks, [awardOpen]: undefined });
                  setAwardOpen(null);
                }}
                className="press mt-4 w-full min-h-12 rounded-2xl border border-gray-300 text-[15px] font-bold text-ink hover:border-ink"
              >
                Clear this award
              </button>
            )}
          </Sheet>
        );
      })()}
    </div>
  );
}
