'use client';

import { retryKeys } from '@/lib/retry-keys';
import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { BallSpinner } from '@/components/skeleton';
import { buzz, stagger } from '@/components/motion';
import { addGoal, addMatchEvent, addMatchGame, deleteGoal, deleteMatchEvent, deleteMatchGame, type GoalInput, type Lineup, type MatchEventKind, type MatchGame, type TeamKey } from '@/lib/api';
import { TEAMS, bibFill, bibOf, bibTint, teamName } from '@/lib/teams';
import { Swatch, shortName } from './teams-step';
import { ScorerSheet } from './scorer-sheet';
import { EventsSection } from './events-section';
import { GameTimer, type TimerApi } from '@/components/game-timer';
import { getTimer, setTimer } from '@/lib/api';

const KEYS = Object.keys(TEAMS) as TeamKey[];

export interface ScoresApi {
  addGame: (sessionId: string, game: { teamA: TeamKey; teamB: TeamKey; scoreA: number; scoreB: number; goals?: GoalInput[] }) => Promise<Lineup>;
  deleteGame: (sessionId: string, gameId: string) => Promise<Lineup>;
  addGoal: (sessionId: string, gameId: string, goal: GoalInput) => Promise<Lineup>;
  deleteGoal: (sessionId: string, goalId: string) => Promise<Lineup>;
  addEvent: (sessionId: string, event: { playerId: string; kind: MatchEventKind }) => Promise<Lineup>;
  deleteEvent: (sessionId: string, eventId: string) => Promise<Lineup>;
}

const ORGANISER: ScoresApi = retryKeys(
  { addGame: addMatchGame, deleteGame: deleteMatchGame, addGoal, deleteGoal, addEvent: addMatchEvent, deleteEvent: deleteMatchEvent },
  ['addGame', 'addGoal', 'addEvent'],
);

const ORGANISER_TIMER: TimerApi = { load: getTimer, save: setTimer };

/**
 * Step 3 of match day: each short game's score. A scoreboard with big − and + for each side
 * (two teams are fixed; with more, tap a side's name to pick who's playing), then the games so
 * far and today's table. The first score locks the teams, and the page says so before it's saved.
 * Tapping + asks who scored and who set it up (two taps, or "Not sure who"); a saved game's
 * scorers can be named or corrected afterwards by tapping it.
 */
export function ScoresStep({
  sessionId,
  lineup,
  dateLabel,
  onLineup,
  onError,
  onPickTeams,
  api = ORGANISER,
  timer = ORGANISER_TIMER,
  timerOn = true,
  canRemove = () => true,
  ended = false,
}: {
  sessionId: string;
  lineup: Lineup;
  /** "Sat 24 Oct", for "Scores open on …". */
  dateLabel: string;
  onLineup: (l: Lineup) => void;
  onError: (message: string) => void;
  onPickTeams: () => void;
  /** Where scores are saved: the organiser's routes, or a captain's from the player app. */
  api?: ScoresApi;
  /** The match-day clock: the organiser's routes, or a captain's. */
  timer?: TimerApi;
  /** Show the clock: while the day is on, not after full time. */
  timerOn?: boolean;
  /** Whether this person can delete a score or a scorer someone recorded ("Ada (captain)"). */
  canRemove?: (recordedBy: string | null | undefined) => boolean;
  /** Full time: the results come first and adding a game is folded away. */
  ended?: boolean;
}) {
  const sideTitle = useId();
  const teams = KEYS.slice(0, lineup.teamCount);
  const [draft, setDraft] = useState({ teamA: 'A' as TeamKey, teamB: 'B' as TeamKey, scoreA: 0, scoreB: 0, goals: [] as GoalInput[] });
  // Asking who scored: for the game being played (`side`) or for one already saved (`gameId`).
  const [scoring, setScoring] = useState<{ team: TeamKey; side?: 'teamA' | 'teamB'; gameId?: string } | null>(null);
  // A saved game whose scorers are open.
  const [editing, setEditing] = useState<string | null>(null);
  const gamesTitle = useId();
  const [choosing, setChoosing] = useState<'teamA' | 'teamB' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MatchGame | null>(null);
  // After full time: the score box for a game that was missed, opened on request.
  const [adding, setAdding] = useState(false);
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

  const name = (t: TeamKey) => teamName(t, lineup.captains, lineup.bibs);
  const who = (id: string | null | undefined) => {
    const m = id ? lineup.squad.find((x) => x.id === id) : null;
    return m ? shortName(m) : 'Someone';
  };
  /** "Ada (Chidi), Bisi": a side's scorers, with who set each one up. */
  const scorersLine = (goals: GoalInput[]) => goals.map((g) => `${who(g.scorerId)}${g.assistId ? ` (${who(g.assistId)})` : ''}`).join(', ');
  const valid = teams.includes(draft.teamA) && teams.includes(draft.teamB) && draft.teamA !== draft.teamB;

  async function save() {
    setBusy('save');
    try {
      onLineup(await api.addGame(sessionId, draft));
      buzz([12, 40, 18]);
      setDraft((d) => ({ ...d, scoreA: 0, scoreB: 0, goals: [] }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'The score didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  }

  /** A goal for the game being played: the score goes up, and the scorer is noted if known. */
  function goalFor(side: 'teamA' | 'teamB', goal: { scorerId: string | null; assistId: string | null }) {
    buzz(6);
    const score = side === 'teamA' ? 'scoreA' : 'scoreB';
    setDraft((d) => ({
      ...d,
      [score]: Math.min(99, d[score] + 1),
      goals: goal.scorerId ? [...d.goals, { team: d[side], scorerId: goal.scorerId, assistId: goal.assistId }] : d.goals,
    }));
  }

  async function nameScorer(gameId: string, goal: GoalInput) {
    setBusy(`goal-${gameId}`);
    try {
      onLineup(await api.addGoal(sessionId, gameId, goal));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function unnameScorer(goalId: string) {
    setBusy(goalId);
    try {
      onLineup(await api.deleteGoal(sessionId, goalId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(g: MatchGame) {
    setRemoving(null);
    setBusy(g.id);
    try {
      onLineup(await api.deleteGame(sessionId, g.id));
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
    const sideGoals = draft.goals.filter((g) => g.team === t);
    // One fewer: the last named scorer goes too, if every goal had a name.
    const minus = () => {
      buzz(6);
      setDraft((d) => {
        const next = Math.max(0, d[score] - 1);
        const mine = d.goals.filter((g) => g.team === t);
        const drop = mine.length > next ? mine[mine.length - 1] : null;
        return { ...d, [score]: next, goals: drop ? d.goals.filter((g) => g !== drop) : d.goals };
      });
    };
    const hasPlayers = lineup.squad.some((m) => m.team === t);
    return (
      <div className="min-w-0 flex flex-col items-center gap-2">
        <button
          onClick={() => teams.length > 2 && setChoosing(side)}
          disabled={teams.length <= 2}
          className="press max-w-full min-h-11 inline-flex items-center gap-1.5 px-3 rounded-full bg-white/10 text-[13px] font-bold text-white disabled:cursor-default"
          aria-label={teams.length > 2 ? `${name(t)}: change team` : undefined}
        >
          <Swatch team={t} bibs={lineup.bibs} className="w-3.5 h-3.5 rounded" />
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
        <button
          onClick={() => (hasPlayers ? setScoring({ team: t, side }) : goalFor(side, { scorerId: null, assistId: null }))}
          aria-label={`Goal for ${name(t)}`}
          className="press w-full min-h-12 rounded-2xl bg-white text-[15px] font-bold text-ink hover:bg-chalk"
        >
          + Goal
        </button>
        <button
          onClick={minus}
          disabled={value === 0}
          aria-label={`Take a goal off ${name(t)}`}
          className="press min-h-11 px-3 rounded-full text-[13px] font-bold text-white/70 hover:text-white disabled:opacity-30"
        >
          − Take one off
        </button>
        {sideGoals.length > 0 && (
          <p className="max-w-full text-center text-[12px] leading-snug font-semibold text-white/75">
            <span aria-hidden>⚽ </span>
            {scorersLine(sideGoals)}
          </p>
        )}
      </div>
    );
  };

  const entry = (
    <>
      <div className="rounded-3xl bg-ink turf-stripes p-4">
        <p className="text-center text-[12px] font-bold text-white/60">Game {lineup.games.length + 1}</p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-1">
          <Side side="teamA" />
          <span className="pt-[60px] font-display text-2xl font-extrabold text-white/30" aria-hidden>
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

    </>
  );
  const events = (
    <>
      <EventsSection
        lineup={lineup}
        busy={busy}
        canRemove={canRemove}
        onAdd={async (playerId, kind) => {
          setBusy('event');
          try {
            onLineup(await api.addEvent(sessionId, { playerId, kind }));
          } catch (err) {
            onError(err instanceof Error ? err.message : 'That didn’t save. Try again.');
          } finally {
            setBusy(null);
          }
        }}
        onRemove={async (eventId) => {
          setBusy(eventId);
          try {
            onLineup(await api.deleteEvent(sessionId, eventId));
          } catch (err) {
            onError(err instanceof Error ? err.message : 'That didn’t save. Try again.');
          } finally {
            setBusy(null);
          }
        }}
      />

    </>
  );
  const results = (
    <>
      {lineup.games.length > 0 && (
        <>
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
                  <Swatch team={r.team} bibs={lineup.bibs} />
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
          <h3 className="mt-5 px-1 text-[13px] font-extrabold text-ink">
            Games today <span className="text-gray-500 tabular-nums">· {lineup.games.length}</span>
          </h3>
          <ol className="mt-1.5 space-y-2">
            {lineup.games.map((g, i) => (
              <li key={g.id} className="relative bg-white rounded-3xl border border-gray-100 shadow-card animate-rise" style={stagger(Math.min(i, 10), 25, 0)}>
                <button
                  onClick={() => setEditing(g.id)}
                  aria-label={`Game ${i + 1}: ${name(g.teamA)} ${g.scoreA}, ${name(g.teamB)} ${g.scoreB}. Scorers`}
                  className="press w-full min-h-12 pl-4 pr-12 py-3 rounded-3xl text-left hover:bg-chalk/60"
                >
                  <span className="block text-[11px] font-extrabold text-gray-500">GAME {i + 1} · FULL TIME</span>
                  <span className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <span className="min-w-0 flex items-center gap-1.5 text-[15px] font-bold text-ink">
                      <Swatch team={g.teamA} bibs={lineup.bibs} />
                      <span className="truncate">{name(g.teamA)}</span>
                    </span>
                    <span className="font-display text-[26px] leading-none font-extrabold text-ink tabular-nums">
                      {g.scoreA}–{g.scoreB}
                    </span>
                    <span className="min-w-0 flex items-center justify-end gap-1.5 text-[15px] font-bold text-ink">
                      <span className="truncate">{name(g.teamB)}</span>
                      <Swatch team={g.teamB} bibs={lineup.bibs} />
                    </span>
                  </span>
                  <span className={`mt-1.5 block text-[12px] leading-snug truncate ${g.goals.length || !(g.scoreA + g.scoreB) ? 'text-gray-600' : 'font-bold text-pitch-700'}`}>
                    {g.goals.length ? `⚽ ${scorersLine(g.goals)}` : g.scoreA + g.scoreB ? 'Tap to name the scorers ›' : 'No goals'}
                  </span>
                </button>
                {canRemove(g.recordedBy) && (
                  <button
                    onClick={() => setRemoving(g)}
                    disabled={!!busy}
                    className="absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-kit-600"
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
                )}
              </li>
            ))}
          </ol>

        </>
      )}

    </>
  );
  const scorersToday = (
    <>
      {lineup.games.some((g) => g.goals.length) && (() => {
        // Today's scorers: goals, then assists, from every game so far.
        const tally = new Map<string, { goals: number; assists: number }>();
        for (const g of lineup.games)
          for (const goal of g.goals) {
            const s = tally.get(goal.scorerId) ?? { goals: 0, assists: 0 };
            s.goals++;
            tally.set(goal.scorerId, s);
            if (goal.assistId) {
              const a = tally.get(goal.assistId) ?? { goals: 0, assists: 0 };
              a.assists++;
              tally.set(goal.assistId, a);
            }
          }
        const rows = [...tally.entries()].sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists || who(a[0]).localeCompare(who(b[0])));
        return (
          <>
            <h3 className="mt-5 px-1 text-[13px] font-extrabold text-ink">Scorers today</h3>
            <div className="mt-1.5 bg-white rounded-3xl border border-gray-100 shadow-card overflow-hidden">
              <div className="grid grid-cols-[1fr_52px_52px] gap-1 px-3.5 py-2 bg-gray-50 text-[11px] font-extrabold text-gray-500">
                <span>Player</span>
                <span className="text-center">Goals</span>
                <span className="text-center">Assists</span>
              </div>
              {rows.map(([id, r]) => (
                <div key={id} className="grid grid-cols-[1fr_52px_52px] gap-1 items-center px-3.5 min-h-11 border-t border-gray-100 text-[14px]">
                  <span className="min-w-0 truncate font-bold text-ink">{who(id)}</span>
                  <span className="text-center font-display font-extrabold text-ink tabular-nums">{r.goals}</span>
                  <span className="text-center text-gray-600 tabular-nums">{r.assists}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

    </>
  );

  return (
    <section aria-label="Scores">
      {ended ? (
        <>
          {/* After full time, the results lead: who scored, each game, the table. Adding a game
              that was missed is still there, folded behind one quiet button. */}
          {lineup.games.length === 0 && (
            <div className="rounded-3xl bg-chalk px-5 py-6 text-center">
              <p className="text-[15px] font-bold text-ink">No scores were added</p>
              <p className="mt-1 text-[13px] text-gray-600">Add the games from today if you have them.</p>
            </div>
          )}
          <div className="[&>h3:first-child]:mt-0">{scorersToday}</div>
          {results}
          {events}
          {adding ? (
            <div className="mt-5">{entry}</div>
          ) : (
            <button onClick={() => setAdding(true)} className="press mt-5 w-full min-h-12 rounded-2xl bg-white border border-gray-300 text-[15px] font-bold text-ink hover:border-ink">
              + Add a game you missed
            </button>
          )}
        </>
      ) : (
        <>
          {/* The match-day clock, above the score box while the day is on */}
          {timerOn && (
            <div className="mb-3">
              <GameTimer sessionId={sessionId} api={timer} onError={onError} />
            </div>
          )}
          {entry}
          {events}
          {results}
          {scorersToday}
        </>
      )}

      {scoring && (
        <ScorerSheet
          team={scoring.team}
          lineup={lineup}
          allowUnnamed={!scoring.gameId}
          scoreAfter={
            scoring.side ? (scoring.side === 'teamA' ? `${draft.scoreA + 1}–${draft.scoreB}` : `${draft.scoreA}–${draft.scoreB + 1}`) : undefined
          }
          onClose={() => setScoring(null)}
          onPick={(goal) => {
            const s = scoring;
            setScoring(null);
            if (s.side) goalFor(s.side, goal);
            else if (s.gameId && goal.scorerId) nameScorer(s.gameId, { team: s.team, scorerId: goal.scorerId, assistId: goal.assistId });
          }}
        />
      )}

      {editing && !scoring && (() => {
        const g = lineup.games.find((x) => x.id === editing);
        if (!g) return null;
        const n = lineup.games.indexOf(g) + 1;
        return (
          <Sheet titleId={gamesTitle} onClose={() => setEditing(null)} align="left">
            <SheetTitle id={gamesTitle} title={`Game ${n}: ${name(g.teamA)} ${g.scoreA}–${g.scoreB} ${name(g.teamB)}`} sub="Who scored, and who set it up." onClose={() => setEditing(null)} />
            {([
              [g.teamA, g.scoreA],
              [g.teamB, g.scoreB],
            ] as [TeamKey, number][]).map(([t, score]) => {
              const goals = g.goals.filter((x) => x.team === t);
              return (
                <div key={t} className="mt-4">
                  <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                    <Swatch team={t} bibs={lineup.bibs} />
                    {name(t)} · {score} goal{score === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-1">
                    {goals.map((goal) => (
                      <li key={goal.id} className="flex items-center gap-2 min-h-12 border-b border-gray-100">
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-bold text-ink truncate">
                            ⚽ {who(goal.scorerId)}
                            {goal.assistId && <span className="font-semibold text-gray-600"> · set up by {who(goal.assistId)}</span>}
                          </span>
                          {goal.recordedBy && <span className="block text-[12px] text-gray-500">Added by {goal.recordedBy}</span>}
                        </span>
                        {canRemove(goal.recordedBy) && (
                        <button
                          onClick={() => unnameScorer(goal.id)}
                          disabled={!!busy}
                          aria-label={`Remove ${who(goal.scorerId)}'s goal`}
                          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:text-kit-600"
                        >
                          {busy === goal.id ? (
                            <BallSpinner className="w-4 h-4" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {goals.length < score ? (
                    <button
                      onClick={() => setScoring({ team: t, gameId: g.id })}
                      disabled={!!busy}
                      className="press mt-2 w-full min-h-11 rounded-2xl border border-dashed border-gray-300 text-[14px] font-bold text-ink hover:border-ink"
                    >
                      {busy === `goal-${g.id}` ? 'Saving…' : `Name a scorer · ${score - goals.length} not named`}
                    </button>
                  ) : (
                    score === 0 && <p className="mt-1 text-[13px] text-gray-500">No goals</p>
                  )}
                </div>
              );
            })}
          </Sheet>
        );
      })()}

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
                    // A different team on that side: its goals so far weren't theirs.
                    setDraft((d) => ({ ...d, [choosing]: t, goals: d.goals.filter((x) => x.team !== d[choosing]) }));
                    setChoosing(null);
                  }}
                  className={`press animate-rise flex items-center gap-2.5 min-h-14 px-3 rounded-2xl border text-left disabled:opacity-40 ${
                    draft[choosing] === t ? 'border-ink bg-chalk' : 'border-gray-200 hover:border-ink'
                  }`}
                  style={stagger(i, 30, 20)}
                >
                  <Swatch team={t} bibs={lineup.bibs} className="w-5 h-5 rounded-md" />
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
