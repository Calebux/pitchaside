'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TEAMS } from '@/components/lineup-card';
import { useToast } from '@/components/toast';
import { startMatchClock, stopMatchClock, subscribeOrganiserPush, type TeamKey } from '@/lib/api';
import { enablePush, getPushState, type PushState } from '@/lib/push';

const PRESETS = [5, 7, 8, 10, 12, 15];
const KEYS = Object.keys(TEAMS) as TeamKey[];

type Saved = { minutes: number; endsAt: number | null; leftMs: number | null; on: TeamKey[] };

function load(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(key: string, s: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* private mode: the clock still runs, it just won't survive a reload */
  }
}

function mmss(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The full-time alarm: three loud beeps and a long buzz. Audio needs a context unlocked by a
 * tap (Start does that); vibration works on Android, not on iPhone.
 */
function useAlarm() {
  const ctx = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    if (ctx.current) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx.current = new Ctor();
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
  return { unlock, ring };
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
 * Match clock for short sets: pick the length, start it, and it beeps and buzzes at full time.
 * The time is kept as an end moment, so it stays right if the screen sleeps or the page reloads;
 * the server also pushes "Time's up" to this organiser's phone for when it's locked.
 */
export function MatchClock({ sessionId, teamCount }: { sessionId: string; teamCount: number }) {
  const toast = useToast();
  const storageKey = `pitchaside.clock.${sessionId}`;
  const [state, setState] = useState<Saved>({ minutes: 10, endsAt: null, leftMs: null, on: [] });
  const [now, setNow] = useState(() => Date.now());
  const [fullTime, setFullTime] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const fired = useRef(false);
  const { unlock, ring } = useAlarm();

  const running = state.endsAt != null;
  const left = running ? state.endsAt! - now : (state.leftMs ?? state.minutes * 60_000);
  const teams = KEYS.slice(0, Math.max(2, teamCount));
  const label = state.on.length === 2 ? `${TEAMS[state.on[0]].name} v ${TEAMS[state.on[1]].name}` : 'Set';

  useWakeLock(running);

  useEffect(() => {
    const saved = load(storageKey);
    if (saved) setState(saved);
    getPushState().then(setPush).catch(() => {});
  }, [storageKey]);

  const update = useCallback(
    (next: Saved) => {
      setState(next);
      save(storageKey, next);
    },
    [storageKey],
  );

  // Tick; ring once when the time runs out (also on coming back to a clock that ran out meanwhile).
  useEffect(() => {
    if (!running) return;
    fired.current = false;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (state.endsAt! - t <= 0 && !fired.current) {
        fired.current = true;
        ring();
        setFullTime(true);
        update({ ...state, endsAt: null, leftMs: null });
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, state, ring, update]);

  function start() {
    unlock();
    setFullTime(false);
    const endsAt = Date.now() + left;
    update({ ...state, endsAt, leftMs: null });
    setNow(Date.now());
    startMatchClock(sessionId, new Date(endsAt).toISOString(), label).catch(() => {});
  }

  function pause() {
    update({ ...state, endsAt: null, leftMs: Math.max(0, state.endsAt! - Date.now()) });
    stopMatchClock(sessionId).catch(() => {});
  }

  function reset(minutes = state.minutes) {
    setFullTime(false);
    update({ ...state, minutes, endsAt: null, leftMs: null });
    stopMatchClock(sessionId).catch(() => {});
  }

  /** Added time while it runs; or set the length before it starts. */
  function addMinute(delta: number) {
    if (running) {
      const endsAt = Math.max(Date.now() + 1000, state.endsAt! + delta * 60_000);
      update({ ...state, endsAt });
      startMatchClock(sessionId, new Date(endsAt).toISOString(), label).catch(() => {});
    } else {
      reset(Math.min(90, Math.max(1, state.minutes + delta)));
    }
  }

  function toggleTeam(t: TeamKey) {
    const on = state.on.includes(t) ? state.on.filter((x) => x !== t) : [...state.on, t].slice(-2);
    update({ ...state, on });
  }

  async function turnOnPush() {
    try {
      const result = await enablePush(subscribeOrganiserPush);
      setPush(result);
      if (result === 'on') toast.success("Done — it'll buzz even with the screen locked");
      else if (result === 'denied') toast.error('Notifications are blocked for this site in your browser settings');
    } catch {
      toast.error("Couldn't turn on notifications");
    }
  }

  const pct = Math.min(100, Math.max(0, 100 - (left / (state.minutes * 60_000)) * 100));

  return (
    <div className={`rounded-3xl p-5 mb-4 text-white ${fullTime ? 'bg-kit-500 animate-pulse' : 'bg-ink'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-volt-300">Match clock</p>
        <p className="text-xs font-bold text-white/70">{label}</p>
      </div>

      <p className="font-display text-7xl font-extrabold tabular-nums text-center leading-none mt-4 mb-1" aria-live="off">
        {fullTime ? 'FULL TIME' : mmss(left)}
      </p>
      {!fullTime && (
        <div className="w-full bg-white/10 rounded-full h-1.5 mt-3 mb-4">
          <div className="bg-volt-400 h-1.5 rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      {!running && !fullTime && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => reset(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                state.minutes === m && state.leftMs == null ? 'bg-volt-400 text-ink' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      )}

      {/* Which two sides are on — named in the full-time buzz */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-4">
        {teams.map((t) => (
          <button
            key={t}
            onClick={() => toggleTeam(t)}
            aria-pressed={state.on.includes(t)}
            className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-bold ${
              state.on.includes(t) ? 'bg-white text-ink' : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <span className={`w-4 h-4 rounded-full ${TEAMS[t].swatch}`} aria-hidden />
            {TEAMS[t].name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] gap-2">
        <button onClick={() => addMinute(-1)} className="px-3.5 py-3 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20" aria-label="One minute less">
          −1
        </button>
        {fullTime ? (
          <button onClick={() => reset()} className="py-3 rounded-xl bg-white text-ink text-sm font-extrabold">
            Next set
          </button>
        ) : running ? (
          <button onClick={pause} className="py-3 rounded-xl bg-white text-ink text-sm font-extrabold">
            Pause
          </button>
        ) : (
          <button onClick={start} className="py-3 rounded-xl bg-volt-400 text-ink text-sm font-extrabold hover:bg-volt-300">
            {state.leftMs != null ? 'Resume' : 'Start'}
          </button>
        )}
        <button onClick={() => addMinute(1)} className="px-3.5 py-3 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20" aria-label="One minute more">
          +1
        </button>
      </div>

      {(running || state.leftMs != null) && (
        <button onClick={() => reset()} className="block mx-auto mt-3 text-xs font-semibold text-white/50 hover:text-white">
          Reset
        </button>
      )}
      {fullTime && (
        <a href="#lineup" className="block text-center mt-3 text-xs font-bold text-white underline underline-offset-2">
          Record the score ↓
        </a>
      )}
      {push && push !== 'on' && push !== 'unsupported' && push !== 'insecure' && (
        <button onClick={turnOnPush} className="block mx-auto mt-3 text-[11px] font-semibold text-volt-300 hover:text-volt-200">
          {push === 'denied' ? 'Notifications are blocked — it only beeps while this page is open' : 'Turn on notifications so it buzzes with the screen locked'}
        </button>
      )}
    </div>
  );
}
