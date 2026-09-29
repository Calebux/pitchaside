'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Avatar } from '@/components/ratings';
import { BallSpinner } from '@/components/skeleton';
import { balanceLineup, getLineup, saveLineup, type Lineup, type Side } from '@/lib/api';

type Member = Lineup['squad'][number];

const next: Record<string, Side | null> = { none: 'bibs', bibs: 'non_bibs', non_bibs: null };

function Stepper({ value, onChange, label, tone }: { value: number; onChange: (v: number) => void; label: string; tone: 'kit' | 'white' }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`text-[10px] font-extrabold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full ${
          tone === 'kit' ? 'bg-kit-500 text-white' : 'bg-white text-ink'
        }`}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 rounded-full bg-white/10 text-white text-lg font-bold hover:bg-white/20"
          aria-label={`${label} minus one`}
        >
          −
        </button>
        <span className="font-display text-5xl font-extrabold text-white tabular-nums w-14 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(99, value + 1))}
          className="w-9 h-9 rounded-full bg-white/10 text-white text-lg font-bold hover:bg-white/20"
          aria-label={`${label} plus one`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Match day: split the squad into bibs / no bibs and record the score. */
export function LineupCard({ sessionId }: { sessionId: string }) {
  const toast = useToast();
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [score, setScore] = useState({ bibs: 0, nonBibs: 0 });
  const [dirtyScore, setDirtyScore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const apply = useCallback((l: Lineup) => {
    setLineup(l);
    setScore({ bibs: l.scoreBibs ?? 0, nonBibs: l.scoreNonBibs ?? 0 });
    setDirtyScore(false);
  }, []);

  useEffect(() => {
    getLineup(sessionId).then(apply).catch(() => {});
  }, [sessionId, apply]);

  if (!lineup || lineup.squad.length === 0) return null;

  async function run(key: string, fn: () => Promise<Lineup>, ok?: string) {
    setBusy(key);
    try {
      const l = await fn();
      if (key === 'score') apply(l);
      else setLineup(l);
      if (ok) toast.success(ok);
    } catch (err: any) {
      toast.error(err.message || 'Could not save');
    } finally {
      setBusy(null);
    }
  }

  const cycle = (m: Member) =>
    run(m.id, () => saveLineup(sessionId, { teams: { [m.id]: next[m.team ?? 'none'] } }));

  const bibs = lineup.squad.filter((m) => m.team === 'bibs');
  const nonBibs = lineup.squad.filter((m) => m.team === 'non_bibs');
  const unpicked = lineup.squad.filter((m) => !m.team);
  const avg = (list: Member[]) => {
    const rated = list.filter((m) => m.ovr != null);
    return rated.length ? Math.round(rated.reduce((s, m) => s + (m.ovr ?? 0), 0) / rated.length) : null;
  };
  const recorded = lineup.scoreBibs != null && lineup.scoreNonBibs != null;

  const Chip = ({ m }: { m: Member }) => (
    <button
      onClick={() => cycle(m)}
      disabled={!!busy}
      className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 bg-white border border-gray-100 hover:border-ink text-left transition-colors disabled:opacity-60"
      title="Tap to switch side"
    >
      <Avatar name={`${m.firstName} ${m.lastName}`} className="w-7 h-7 text-[10px]" />
      <span className="flex-1 text-sm font-semibold text-ink truncate">{m.firstName}</span>
      {busy === m.id ? (
        <BallSpinner className="w-3.5 h-3.5" />
      ) : (
        m.ovr != null && <span className="text-[10px] font-extrabold text-gray-400 tabular-nums">{m.ovr}</span>
      )}
    </button>
  );

  const Column = ({ title, list, tone }: { title: string; list: Member[]; tone: 'kit' | 'ink' }) => (
    <div className={`rounded-2xl p-2.5 ${tone === 'kit' ? 'bg-kit-400/15' : 'bg-chalk'}`}>
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink">
          <span className={`w-2.5 h-2.5 rounded-sm ${tone === 'kit' ? 'bg-kit-500' : 'bg-white border border-ink'}`} />
          {title} · {list.length}
        </span>
        {avg(list) != null && <span className="text-[10px] font-bold text-gray-500">avg {avg(list)}</span>}
      </div>
      <div className="space-y-1.5">
        {list.map((m) => (
          <Chip key={m.id} m={m} />
        ))}
        {list.length === 0 && <p className="text-xs text-gray-400 px-1 py-2">Tap players to add</p>}
      </div>
    </div>
  );

  return (
    <section className="mb-6 bg-white rounded-3xl border border-gray-100 shadow-card overflow-hidden">
      {/* Scoreboard */}
      <div className="relative bg-ink turf-stripes px-5 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">Match day</p>
          {recorded && !dirtyScore && <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/50">Full-time</span>}
        </div>
        <div className="flex items-center justify-center gap-4 sm:gap-8 mt-3">
          <Stepper label="Bibs" tone="kit" value={score.bibs} onChange={(v) => { setScore({ ...score, bibs: v }); setDirtyScore(true); }} />
          <span className="font-display text-3xl font-extrabold text-white/30 mt-6">–</span>
          <Stepper label="No bibs" tone="white" value={score.nonBibs} onChange={(v) => { setScore({ ...score, nonBibs: v }); setDirtyScore(true); }} />
        </div>
        {(dirtyScore || !recorded) && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => run('score', () => saveLineup(sessionId, { score }), 'Score saved')}
              disabled={busy === 'score'}
              className="px-5 py-2.5 text-sm font-bold text-ink bg-volt-400 rounded-xl hover:bg-volt-300 disabled:opacity-50 flex items-center gap-2"
            >
              {busy === 'score' && <BallSpinner />}
              {recorded ? 'Update score' : 'Save final score'}
            </button>
          </div>
        )}
      </div>

      {/* Sides */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs text-gray-500">Tap a player to switch sides. Results feed everyone&apos;s W-D-L.</p>
          <button
            onClick={() => run('balance', () => balanceLineup(sessionId), 'Teams balanced by rating')}
            disabled={!!busy}
            className="shrink-0 px-3 py-2 text-xs font-bold text-ink bg-volt-300 border border-volt-400 rounded-xl hover:bg-volt-400 disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy === 'balance' ? <BallSpinner className="w-3.5 h-3.5" /> : '✦'} Balance by rating
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Column title="Bibs" list={bibs} tone="kit" />
          <Column title="No bibs" list={nonBibs} tone="ink" />
        </div>
        {unpicked.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">Not picked ({unpicked.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {unpicked.map((m) => (
                <Chip key={m.id} m={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
