'use client';

import { useEffect, useState } from 'react';
import { TEAMS, teamName } from '@/lib/teams';
import { BallSpinner } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LiveDot } from '@/components/motion';
import type { TeamKey } from '@/lib/api';
import { getGameLineup, pickBib, type GameLineup, type GamePaid } from '@/lib/player';

const KEYS = Object.keys(TEAMS) as TeamKey[];

function PaidTag({ paid }: { paid: GamePaid | null }) {
  if (!paid) return null;
  if (paid === 'paid') return <span className="text-[10px] font-extrabold text-volt-300">✓ Paid</span>;
  if (paid === 'waived') return <span className="text-[10px] font-bold text-white/60">Free</span>;
  return <span className="text-[10px] font-extrabold text-sun-400">To pay</span>;
}

/**
 * Match day on the player's game card: tap the team you're in — by captain once the organiser has
 * named one, else by bib colour — then follow the day live: the table, each game's score and who
 * scored, cards and saves. It checks for new scores every 30 seconds while the screen is open.
 */
export function MatchDayBibs({ sessionId, live = false }: { sessionId: string; live?: boolean }) {
  const toast = useToast();
  const [lineup, setLineup] = useState<GameLineup | null>(null);
  const [saving, setSaving] = useState<TeamKey | null>(null);
  // A captain switching sides is asked first: the armband stays with the side they leave.
  const [switching, setSwitching] = useState<TeamKey | null>(null);

  useEffect(() => {
    const load = () => getGameLineup(sessionId).then(setLineup).catch(() => undefined);
    load();
    if (!live) return;
    // Scores come in from the organiser's and captains' phones: look again while it's being watched.
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 30_000);
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [sessionId, live]);

  if (!lineup) return null;
  const teams = KEYS.slice(0, lineup.teamCount);

  const amCaptain = !!lineup.squad.find((p) => p.me)?.captain;

  /**
   * Their own side again does nothing: clearing it used to drop a captain's armband (and their
   * "Keep the score") without a word. A captain picking another side is asked first.
   */
  function choose(team: TeamKey) {
    if (lineup?.myTeam === team) return;
    if (amCaptain) setSwitching(team);
    else save(team);
  }

  async function save(next: TeamKey) {
    setSwitching(null);
    setSaving(next);
    try {
      setLineup(await pickBib(sessionId, next));
      toast.success(lineup?.captains[next] ? `Bib saved: Team ${lineup.captains[next]}` : `Bib saved: ${TEAMS[next].name.toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your team");
    } finally {
      setSaving(null);
    }
  }

  const byTeam = (t: TeamKey | null) => lineup.squad.filter((p) => p.team === t);
  const noBib = byTeam(null);

  const myTeam = lineup.myTeam;
  return (
    <div className="mt-4 rounded-2xl bg-white/[0.07] p-3.5 space-y-3 text-white">
      <ConfirmDialog
        open={!!switching}
        variant="danger"
        title={myTeam ? `Stop captaining ${teamName(myTeam, lineup.captains)}?` : 'Stop being captain?'}
        message={`You captain ${myTeam ? teamName(myTeam, lineup.captains) : 'your side'} today. Moving to ${
          switching ? teamName(switching, lineup.captains) : 'another team'
        } means you stop being captain and can't keep the score. The organiser can make you captain again.`}
        confirmLabel="Move and stop captaining"
        cancelLabel="Stay captain"
        onConfirm={() => switching && save(switching)}
        onCancel={() => setSwitching(null)}
      />
      {lineup.bibsOpen ? (
        <div>
          <p className="text-[13px] font-bold text-white mb-2">{Object.keys(lineup.captains).length ? 'Which team are you in?' : 'Which bib are you in?'}</p>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => {
              const mine = lineup.myTeam === t;
              return (
                <button
                  key={t}
                  onClick={() => choose(t)}
                  disabled={!!saving}
                  aria-pressed={mine}
                  className={`flex items-center gap-2 min-h-11 pl-2 pr-3.5 rounded-full text-[13px] font-bold transition-colors disabled:opacity-60 ${
                    mine ? 'bg-volt-400 text-ink' : 'bg-white/10 text-white border border-white/15 hover:border-white/40'
                  }`}
                >
                  {saving === t ? <BallSpinner /> : <span className={`w-5 h-5 rounded-full ${TEAMS[t].swatch}`} aria-hidden />}
                  {teamName(t, lineup.captains)}
                </button>
              );
            })}
          </div>
        </div>
      ) : lineup.live?.games.length ? null : (
        <p className="text-xs text-white/70">
          {lineup.bibsClosed ? 'Teams are set: the scores are in.' : 'Picking your team opens on match day.'}
        </p>
      )}

      {lineup.live && lineup.live.games.length > 0 && <Live live={lineup.live} captains={lineup.captains} myTeam={lineup.myTeam} />}


      {lineup.squad.some((p) => p.team) && (
        <div className="space-y-2">
          {teams
            .filter((t) => byTeam(t).length)
            .map((t) => (
              <div key={t}>
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/60 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-sm ${TEAMS[t].swatch}`} aria-hidden />
                  {teamName(t, lineup.captains)} · {byTeam(t).length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {byTeam(t).map((p) => (
                    <span key={p.name} className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                      <span className={`text-xs ${p.me ? 'font-extrabold text-volt-300' : 'font-semibold text-white'}`}>{p.me ? 'You' : p.name}</span>
                      {p.captain && <span className="text-[10px] font-extrabold text-volt-300">(C)</span>}
                      <PaidTag paid={p.paid} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          {noBib.length > 0 && (
            <p className="text-[11px] text-white/60">
              No team yet: {noBib.map((p) => (p.me ? 'you' : p.name.split(' ')[0])).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { yellow: 'Yellow card', red: 'Red card', save: 'Save' };

/**
 * The day so far: the teams' table (your side marked), then each game newest first with its
 * score and who scored, then cards and saves. Team colour is always written beside the swatch.
 */
function Live({ live, captains, myTeam }: { live: NonNullable<GameLineup['live']>; captains: GameLineup['captains']; myTeam: TeamKey | null }) {
  const played = live.table.rows.filter((r) => r.p > 0);
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="flex items-center gap-2 text-[13px] font-bold text-white">
        <LiveDot className="bg-volt-400" />
        The day so far · {live.games.length} game{live.games.length === 1 ? '' : 's'}
      </p>

      <table className="w-full text-[13px] tabular-nums">
        <caption className="sr-only">Today’s table</caption>
        <thead>
          <tr className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/50">
            <th className="text-left font-extrabold pb-1">Team</th>
            <th className="w-7 text-center font-extrabold pb-1">P</th>
            <th className="w-6 text-center font-extrabold pb-1">W</th>
            <th className="w-6 text-center font-extrabold pb-1">D</th>
            <th className="w-6 text-center font-extrabold pb-1">L</th>
            <th className="w-8 text-right font-extrabold pb-1">Pts</th>
          </tr>
        </thead>
        <tbody>
          {played.map((r) => (
            <tr key={r.team} className={r.team === myTeam ? 'text-volt-300' : 'text-white'}>
              <td className="py-1">
                <span className="flex items-center gap-1.5 min-w-0 font-bold">
                  <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${TEAMS[r.team].swatch}`} aria-hidden />
                  <span className="truncate">{teamName(r.team, captains)}</span>
                  {r.team === myTeam && <span className="text-[10px] font-extrabold">· you</span>}
                  {live.table.teamOfTheDay === r.team && <span aria-label="leading">🏆</span>}
                </span>
              </td>
              <td className="text-center">{r.p}</td>
              <td className="text-center">{r.w}</td>
              <td className="text-center">{r.d}</td>
              <td className="text-center">{r.l}</td>
              <td className="text-right font-display font-extrabold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ol className="space-y-1.5">
        {[...live.games].reverse().map((g, i) => {
          const scorers = (team: TeamKey) =>
            g.goals
              .filter((x) => x.team === team && x.scorer)
              .map((x) => `${x.mine ? 'You' : x.scorer}${x.assist ? ` (${x.assist})` : ''}`)
              .join(', ');
          return (
            <li key={g.id} className="rounded-xl bg-white/[0.06] px-3 py-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/50">Game {live.games.length - i}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[14px] font-bold text-white">
                <span className="flex-1 min-w-0 truncate text-right">{teamName(g.teamA, captains)}</span>
                <span className="shrink-0 font-display text-[18px] font-extrabold tabular-nums">
                  {g.scoreA} – {g.scoreB}
                </span>
                <span className="flex-1 min-w-0 truncate">{teamName(g.teamB, captains)}</span>
              </p>
              {g.goals.some((x) => x.scorer) && (
                <p className="mt-1 grid grid-cols-2 gap-3 text-[11px] text-white/70">
                  <span className="text-right">{scorers(g.teamA) && `⚽ ${scorers(g.teamA)}`}</span>
                  <span>{scorers(g.teamB) && `⚽ ${scorers(g.teamB)}`}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {live.events.some((e) => e.name) && (
        <p className="text-[12px] text-white/70">
          {live.events
            .filter((e) => e.name)
            .map((e) => `${KIND_LABEL[e.kind]}: ${e.mine ? 'you' : e.name}`)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}
