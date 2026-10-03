'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TEAMS } from '@/components/lineup-card';
import { useToast } from '@/components/toast';
import type { ClockAction, ClockState, TeamKey } from '@/lib/api';
import { enablePush, getPushState, type PushState } from '@/lib/push';

const PRESETS = [5, 7, 8, 10, 12, 15];
const KEYS = Object.keys(TEAMS) as TeamKey[];
/** How often a phone checks for someone else starting, pausing or adding time. */
const POLL_MS = 3000;

function mmss(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The full-time alarm: three loud beeps and a long buzz. Browsers only play sound after a tap
 * on the page, so the clock asks for one ("Tap for sound") if nobody's tapped yet; vibration
 * works on Android, not on iPhone.
 */
function useAlarm() {
  const ctx = useRef<AudioContext | null>(null);
  const [armed, setArmed] = useState(false);
  const unlock = useCallback(() => {
    if (!ctx.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) ctx.current = new Ctor();
    }
    ctx.current?.resume().catch(() => {});
    setArmed(!!ctx.current);
  }, []);
  const ring = useCallback(() => {
    navigator.vibrate?.([600, 200, 600, 200, 1200]);
    const ac = ctx.current;
    if (!ac) return;
    ac.resume().catch(() => {});
    for (let i = 0; i < 3; i++) {
      const at = ac.currentTime + i * 0.7;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.6, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      osc.connect(gain).connect(ac.destination);
      osc.start(at);
      osc.stop(at + 0.55);
    }
  }, []);
  return { armed, unlock, ring };
}

/** Keeps the screen awake while the clock runs, so it can be watched and heard. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const grab = () => {
      navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    };
    const onVisible = () => document.visibilityState === 'visible' && grab();
    grab();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/**
 * A game's match clock, the same on every phone: the organiser and anyone in the squad can
 * start, pause, add time or reset it, and every open page beeps at full time. The server
 * also pushes "Time's up" to phones that are locked, once notifications are on.
 */
export function MatchClock({
  sessionId,
  load,
  act,
  savePush,
  onRecordScore,
}: {
  sessionId: string;
  load: () => Promise<ClockState>;
  act: (a: ClockAction) => Promise<ClockState>;
  /** Saves this device's push subscription (organiser or player). */
  savePush: (sub: PushSubscriptionJSON) => Promise<unknown>;
  /** "Record the score" at full time; organisers only. */
  onRecordScore?: () => void;
}) {
  const toast = useToast();
  const [clock, setClock] = useState<ClockState | null>(null);
  const [offset, setOffset] = useState(0); // server time − this phone's time
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const { armed, unlock, ring } = useAlarm();
  const firedKey = `pitchaside.clock.rang.${sessionId}`;

  const take = useCallback((s: ClockState) => {
    setClock(s);
    setOffset(new Date(s.serverNow).getTime() - Date.now());
  }, []);

  // Someone else may run the clock: check often while the page is on screen.
  useEffect(() => {
    let alive = true;
    const fetchNow = () => load().then((s) => alive && take(s)).catch(() => {});
    // Always load once; after that, only check while the page is on screen.
    const pull = () => document.visibilityState === 'visible' && fetchNow();
    fetchNow();
    const id = setInterval(pull, POLL_MS);
    document.addEventListener('visibilitychange', pull);
    getPushState().then(setPush).catch(() => {});
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', pull);
    };
  }, [load, take]);

  const endsAt = clock?.endsAt ? new Date(clock.endsAt).getTime() : null;
  const serverNow = now + offset;
  const running = endsAt != null && endsAt > serverNow;
  const fullTime = endsAt != null && endsAt <= serverNow;
  const left = running ? endsAt! - serverNow : (clock?.leftMs ?? (clock?.minutes ?? 10) * 60_000);

  useWakeLock(running);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Ring once per set, on every phone that has the clock open — not again on a reload.
  useEffect(() => {
    if (!fullTime || !clock?.endsAt) return;
    let rang: string | null = null;
    try {
      rang = localStorage.getItem(firedKey);
    } catch {
      /* ignore */
    }
    if (rang === clock.endsAt) return;
    // Only if it ended in the last minute: opening the page later shouldn't set it off.
    if (serverNow - endsAt! < 60_000) ring();
    try {
      localStorage.setItem(firedKey, clock.endsAt);
    } catch {
      /* ignore */
    }
  }, [fullTime, clock?.endsAt, endsAt, serverNow, firedKey, ring]);

  async function send(a: ClockAction) {
    unlock();
    setBusy(true);
    try {
      take(await act(a));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the clock");
    } finally {
      setBusy(false);
    }
  }

  async function turnOnPush() {
    try {
      const result = await enablePush(savePush);
      setPush(result);
      if (result === 'on') toast.success("Done — it'll buzz even with the screen locked");
      else if (result === 'denied') toast.error('Notifications are blocked for this site in your browser settings');
    } catch {
      toast.error("Couldn't turn on notifications");
    }
  }

  if (!clock) return <div className="rounded-3xl bg-ink h-72 mb-4 animate-pulse" />;

  const teams = KEYS.slice(0, Math.max(2, clock.teamCount));
  const pct = Math.min(100, Math.max(0, 100 - (left / (clock.minutes * 60_000)) * 100));
  const paused = !running && !fullTime && clock.leftMs != null;

  return (
    <div className={`rounded-3xl p-5 mb-4 text-white ${fullTime ? 'bg-kit-500' : 'bg-ink'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-volt-300">Match clock</p>
        <p className="text-xs font-bold text-white/70">{clock.label}</p>
      </div>

      <p className="font-display text-7xl font-extrabold tabular-nums text-center leading-none mt-4 mb-1">
        {fullTime ? 'FULL TIME' : mmss(left)}
      </p>
      <p className="text-center text-[11px] font-semibold text-white/50 h-4">
        {running ? 'Running — same on every phone' : paused ? 'Paused' : fullTime ? '' : `${clock.minutes}-minute set`}
      </p>
      {!fullTime && (
        <div className="w-full bg-white/10 rounded-full h-1.5 mt-3 mb-4">
          <div className="bg-volt-400 h-1.5 rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      {!running && !paused && !fullTime && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => send({ action: 'reset', minutes: m })}
              disabled={busy}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                clock.minutes === m ? 'bg-volt-400 text-ink' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      )}

      {/* The two sides on — named on every phone and in the full-time buzz */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-4 mt-3">
        {teams.map((t) => {
          const on = clock.teams.includes(t);
          return (
            <button
              key={t}
              onClick={() => send({ action: 'teams', teams: on ? clock.teams.filter((x) => x !== t) : [...clock.teams, t].slice(-2) })}
              disabled={busy}
              aria-pressed={on}
              className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-bold ${
                on ? 'bg-white text-ink' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <span className={`w-4 h-4 rounded-full ${TEAMS[t].swatch}`} aria-hidden />
              {TEAMS[t].name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] gap-2">
        <button onClick={() => send({ action: 'adjust', delta: -1 })} disabled={busy || fullTime} className="px-3.5 py-3 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20 disabled:opacity-40" aria-label="One minute less">
          −1
        </button>
        {fullTime ? (
          <button onClick={() => send({ action: 'reset' })} disabled={busy} className="py-3 rounded-xl bg-white text-ink text-sm font-extrabold">
            Next set
          </button>
        ) : running ? (
          <button onClick={() => send({ action: 'pause' })} disabled={busy} className="py-3 rounded-xl bg-white text-ink text-sm font-extrabold">
            Pause
          </button>
        ) : (
          <button onClick={() => send({ action: 'start' })} disabled={busy} className="py-3 rounded-xl bg-volt-400 text-ink text-sm font-extrabold hover:bg-volt-300">
            {paused ? 'Resume' : 'Start'}
          </button>
        )}
        <button onClick={() => send({ action: 'adjust', delta: 1 })} disabled={busy || fullTime} className="px-3.5 py-3 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20 disabled:opacity-40" aria-label="One minute more">
          +1
        </button>
      </div>

      {(running || paused) && (
        <button onClick={() => send({ action: 'reset' })} disabled={busy} className="block mx-auto mt-3 text-xs font-semibold text-white/50 hover:text-white">
          Reset
        </button>
      )}
      {fullTime && onRecordScore && (
        <button onClick={onRecordScore} className="block mx-auto mt-3 text-xs font-bold text-white underline underline-offset-2">
          Record the score →
        </button>
      )}
      {!armed && (
        <button onClick={unlock} className="block mx-auto mt-3 text-[11px] font-bold text-white/70 hover:text-white">
          🔈 Tap for sound at full time
        </button>
      )}
      {push && push !== 'on' && push !== 'unsupported' && push !== 'insecure' && (
        <button onClick={turnOnPush} className="block mx-auto mt-2 text-[11px] font-semibold text-volt-300 hover:text-volt-200">
          {push === 'denied' ? 'Notifications are blocked — it only beeps while this page is open' : 'Turn on notifications so it buzzes with the screen locked'}
        </button>
      )}
    </div>
  );
}
