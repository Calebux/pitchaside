'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { BallSpinner } from '@/components/skeleton';
import { buzz, stagger } from '@/components/motion';
import { addMatchGame, deleteMatchGame, type Lineup, type MatchGame, type TeamKey } from '@/lib/api';
import { TEAMS, teamName } from '@/lib/teams';
import { Swatch } from './teams-step';

const KEYS = Object.keys(TEAMS) as TeamKey[];

/**
 * Step 3 of match day: each short game's score. A scoreboard with big − and + for each side
 * (two teams are fixed; with more, tap a side's name to pick who's playing), then the games so
 * far and today's table. The first score locks the teams, and the page says so before it's saved.
 */
export function ScoresStep({
  sessionId,
  lineup,
  dateLabel,
  onLineup,
  onError,
  onPickTeams,
}: {
  sessionId: string;
  lineup: Lineup;
  /** "Sat 24 Oct", for "Scores open on …". */
  dateLabel: string;
  onLineup: (l: Lineup) => void;
  onError: (message: string) => void;
  onPickTeams: () => void;
}) {
  const sideTitle = useId();
  const teams = KEYS.slice(0, lineup.teamCount);
  const [draft, setDraft] = useState({ teamA: 'A' as TeamKey, teamB: 'B' as TeamKey, scoreA: 0, scoreB: 0 });
  const [choosing, setChoosing] = useState<'teamA' | 'teamB' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MatchGame | null>(null);
  const onSides = lineup.squad.filter((m) => m.team).length;

  if (!lineup.scoresOpen) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] font-bold text-ink">Scores open on match day</p>
        <p className="mt-1 text-sm text-gray-600">Come back on {dateLabel} to add each game’s score.</p>
      </div>
    );
  }
  if (!onSides) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] font-bold text-ink">Pick the teams first</p>
        <p className="mt-1 text-sm text-gray-600">Each score counts for the players on the two teams.</p>
        <button onClick={onPickTeams} className="press mt-4 min-h-12 px-5 rounded-2xl bg-ink text-volt-300 text-[15px] font-bold">
          Pick teams
        </button>
      </div>
    );
  }

  const name = (t: TeamKey) => teamName(t, lineup.captains);
  const valid = teams.includes(draft.teamA) && teams.includes(draft.teamB) && draft.teamA !== draft.teamB;

  async function save() {
    setBusy('save');
    try {
      onLineup(await addMatchGame(sessionId, draft));
      buzz([12, 40, 18]);
      setDraft((d) => ({ ...d, scoreA: 0, scoreB: 0 }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'The score didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(g: MatchGame) {
    setRemoving(null);
    setBusy(g.id);
    try {
      onLineup(await deleteMatchGame(sessionId, g.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'That didn’t delete. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const Side = ({ side }: { side: 'teamA' | 'teamB' }) => {
    const t = draft[side];
    const score = side === 'teamA' ? 'scoreA' : 'scoreB';
    const value = draft[score];
    const set = (v: number) => {
      buzz(6);
      setDraft((d) => ({ ...d, [score]: Math.max(0, Math.min(99, v)) }));
    };
    return (
      <div className="min-w-0 flex flex-col items-center gap-2">
        <button
          onClick={() => teams.length > 2 && setChoosing(side)}
          disabled={teams.length <= 2}
          className="press max-w-full min-h-11 inline-flex items-center gap-1.5 px-3 rounded-full bg-white/10 text-[13px] font-bold text-white disabled:cursor-default"
          aria-label={teams.length > 2 ? `${name(t)}: change team` : undefined}
        >
          <Swatch team={t} className="w-3.5 h-3.5 rounded" />
          <span className="truncate">{name(t)}</span>
          {teams.length > 2 && (
            <svg className="w-3.5 h-3.5 shrink-0 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </button>
        <span className="font-display text-[56px] leading-none font-extrabold text-white tabular-nums" aria-live="polite" aria-label={`${name(t)} ${value}`}>
          {value}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => set(value - 1)}
            disabled={value === 0}
            aria-label={`${name(t)} minus one`}
            className="press w-12 h-12 rounded-full bg-white/10 text-2xl font-bold text-white hover:bg-white/20 disabled:opacity-30"
          >
            −
          </button>
          <button
            onClick={() => set(value + 1)}
            aria-label={`${name(t)} plus one`}
            className="press w-12 h-12 rounded-full bg-volt-400 text-2xl font-bold text-ink hover:bg-volt-300"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Scores">
      <div className="rounded-3xl bg-ink turf-stripes p-4">
        <p className="text-center text-[12px] font-bold text-white/60">Game {lineup.games.length + 1}</p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-1">
          <Side side="teamA" />
          <span className="pt-[70px] font-display text-2xl font-extrabold text-white/30" aria-hidden>
            –
          </span>
          <Side side="teamB" />
        </div>
        <button
          onClick={save}
          disabled={!!busy || !valid}
          className="press mt-4 w-full min-h-12 rounded-2xl bg-volt-400 text-ink text-[15px] font-bold hover:bg-volt-300 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy === 'save' && <BallSpinner className="w-4 h-4" />}
          Save {name(draft.teamA)} {draft.scoreA}–{draft.scoreB} {name(draft.teamB)}
        </button>
        {!lineup.locked && <p className="mt-2 text-center text-[12px] text-white/60">Saving the first score locks the teams.</p>}
      </div>

      {lineup.games.length > 0 && (
        <>
          <h3 className="mt-5 px-1 text-[13px] font-extrabold text-ink">
            Games today <span className="text-gray-500 tabular-nums">· {lineup.games.length}</span>
          </h3>
          <ol className="mt-1.5 bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 overflow-hidden">
            {lineup.games.map((g, i) => (
              <li key={g.id} className="flex items-center gap-2 pl-3.5 pr-1 min-h-12 animate-rise" style={stagger(Math.min(i, 10), 25, 0)}>
                <span className="w-5 text-[11px] font-extrabold text-gray-500 tabular-nums">{i + 1}</span>
                <span className="flex-1 min-w-0 flex items-center justify-end gap-1.5 text-[14px] font-bold text-ink">
                  <span className="truncate">{name(g.teamA)}</span>
                  <Swatch team={g.teamA} />
                </span>
                <span className="font-display text-[17px] font-extrabold text-ink tabular-nums px-1">
                  {g.scoreA}–{g.scoreB}
                </span>
                <span className="flex-1 min-w-0 flex items-center gap-1.5 text-[14px] font-bold text-ink">
                  <Swatch team={g.teamB} />
                  <span className="truncate">{name(g.teamB)}</span>
                </span>
                <button
                  onClick={() => setRemoving(g)}
                  disabled={!!busy}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:text-kit-600"
                  aria-label={`Delete game ${i + 1}`}
                >
                  {busy === g.id ? (
                    <BallSpinner className="w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ol>

          <h3 className="mt-5 px-1 text-[13px] font-extrabold text-ink">Today’s table</h3>
          <div className="mt-1.5 bg-white rounded-3xl border border-gray-100 shadow-card overflow-hidden">
            <div className="grid grid-cols-[1fr_repeat(4,26px)_34px_36px] gap-1 px-3.5 py-2 bg-gray-50 text-[11px] font-extrabold text-gray-500">
              <span>Team</span>
              <span className="text-center">P</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-center">GD</span>
              <span className="text-right">Pts</span>
            </div>
            {lineup.standings.map((r) => (
              <div
                key={r.team}
                className={`grid grid-cols-[1fr_repeat(4,26px)_34px_36px] gap-1 items-center px-3.5 min-h-11 border-t border-gray-100 text-[14px] ${
                  lineup.teamOfTheDay === r.team ? 'bg-volt-100' : ''
                }`}
              >
                <span className="min-w-0 flex items-center gap-2 font-bold text-ink">
                  <Swatch team={r.team} />
                  <span className="truncate">{name(r.team)}</span>
                </span>
                {[r.p, r.w, r.d, r.l].map((v, i) => (
                  <span key={i} className="text-center text-gray-600 tabular-nums">
                    {v}
                  </span>
                ))}
                <span className="text-center text-gray-600 tabular-nums">{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</span>
                <span className="text-right font-display font-extrabold text-ink tabular-nums">{r.pts}</span>
              </div>
            ))}
            {lineup.teamOfTheDay && (
              <p className="px-3.5 py-2.5 border-t border-gray-100 text-[13px] font-bold text-pitch-700">
                🏆 Team of the Day so far: {name(lineup.teamOfTheDay)}
              </p>
            )}
          </div>
        </>
      )}

      {choosing && (
        <Sheet titleId={sideTitle} onClose={() => setChoosing(null)} align="left">
          <SheetTitle id={sideTitle} title="Who’s playing?" sub={choosing === 'teamA' ? 'The team on the left' : 'The team on the right'} onClose={() => setChoosing(null)} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {teams.map((t, i) => {
              const other = choosing === 'teamA' ? draft.teamB : draft.teamA;
              const taken = t === other;
              return (
                <button
                  key={t}
                  disabled={taken}
                  onClick={() => {
                    setDraft((d) => ({ ...d, [choosing]: t }));
                    setChoosing(null);
                  }}
                  className={`press animate-rise flex items-center gap-2.5 min-h-14 px-3 rounded-2xl border text-left disabled:opacity-40 ${
                    draft[choosing] === t ? 'border-ink bg-chalk' : 'border-gray-200 hover:border-ink'
                  }`}
                  style={stagger(i, 30, 20)}
                >
                  <Swatch team={t} className="w-5 h-5 rounded-md" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-ink truncate">{name(t)}</span>
                    {taken && <span className="block text-[12px] text-gray-500">On the other side</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Delete this score?"
        message={
          removing
            ? `${name(removing.teamA)} ${removing.scoreA}–${removing.scoreB} ${name(removing.teamB)} comes off today’s table and everyone’s record.${
                lineup.games.length === 1 ? ' With no scores left, the teams can be changed again.' : ''
              }`
            : ''
        }
        confirmLabel="Delete score"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
