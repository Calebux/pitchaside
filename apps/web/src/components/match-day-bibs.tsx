'use client';

import { useEffect, useState } from 'react';
import { TEAMS, bibFill, bibOf, bibTint, teamName } from '@/lib/teams';
import { BallSpinner } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
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
 * named one, else by bib colour — and see the squad by team, with who's paid when the group shares that.
 */
export function MatchDayBibs({ sessionId }: { sessionId: string }) {
  const toast = useToast();
  const [lineup, setLineup] = useState<GameLineup | null>(null);
  const [saving, setSaving] = useState<TeamKey | null>(null);
  // A captain switching sides is asked first: the armband stays with the side they leave.
  const [switching, setSwitching] = useState<TeamKey | null>(null);

  useEffect(() => {
    getGameLineup(sessionId).then(setLineup).catch(() => setLineup(null));
  }, [sessionId]);

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
      toast.success(lineup?.captains[next] ? `Bib saved: ${teamName(next, lineup.captains, lineup.bibs)}` : `Bib saved: ${teamName(next, undefined, lineup?.bibs)}`);
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
        title={myTeam ? `Stop captaining ${teamName(myTeam, lineup.captains, lineup.bibs)}?` : 'Stop being captain?'}
        message={`You captain ${myTeam ? teamName(myTeam, lineup.captains, lineup.bibs) : 'your side'} today. Moving to ${
          switching ? teamName(switching, lineup.captains, lineup.bibs) : 'another team'
        } means you stop being captain and can't keep the score. The organiser can make you captain again.`}
        confirmLabel="Move and stop captaining"
        cancelLabel="Stay captain"
        onConfirm={() => switching && save(switching)}
        onCancel={() => setSwitching(null)}
      />
      {lineup.bibsOpen ? (
        <div>
          <p className="text-[13px] font-bold text-white mb-2">{Object.keys(lineup.captains).length || lineup.bibs && Object.values(lineup.bibs).some((b) => b?.name) ? 'Which team are you in?' : 'Which bib are you in?'}</p>
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
                  {saving === t ? <BallSpinner /> : <span className="w-5 h-5 rounded-full" style={bibFill(t, lineup.bibs)} aria-hidden />}
                  {teamName(t, lineup.captains, lineup.bibs)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/70">
          {lineup.bibsClosed ? 'Teams are set: the scores are in.' : 'Picking your team opens on match day.'}
        </p>
      )}


      {lineup.squad.some((p) => p.team) && (
        <div className="space-y-2">
          {teams
            .filter((t) => byTeam(t).length)
            .map((t) => (
              <div key={t}>
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/60 mb-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={bibFill(t, lineup.bibs)} aria-hidden />
                  {teamName(t, lineup.captains, lineup.bibs)} · {byTeam(t).length}
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
