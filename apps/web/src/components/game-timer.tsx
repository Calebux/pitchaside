'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameTimer as Timer } from '@pitchaside/shared';
import { buzz, LiveDot } from '@/components/motion';
import { BallSpinner } from '@/components/skeleton';

export interface TimerApi {
  load: (sessionId: string) => Promise<Timer>;
  /** Left out for players who only watch the clock. */
  save?: (sessionId: string, change: { start?: boolean; minutes?: number }) => Promise<Timer>;
}

/** Lengths most 5-a-side games use, one tap each; − and + cover the rest. */
const QUICK = [5, 7, 10, 12, 15];
const POLL_MS = 15_000;
/** Watchers stop showing "Time's up" this long after the whistle, so an old clock doesn't linger. */
const WATCH_UP_MS = 5 * 60_000;

// This phone started the clock: it's the one that buzzes and beeps at time.
const mineKey = (sessionId: string) => `pitchaside.timer.${sessionId}`;
const readMine = (sessionId: string) => {
  try {
    return localStorage.getItem(mineKey(sessionId));
  } catch {
    return null;
  }
};
const writeMine = (sessionId: string, startedAt: string | null) => {
  try {
    if (startedAt) localStorage.setItem(mineKey(sessionId), startedAt);
    else localStorage.removeItem(mineKey(sessionId));
  } catch {
    // Private mode: it still counts down, it just won't know it's this phone after a reload.
  }
};

// Phones only play sound after a tap, so the sound is set up on the Start tap and reused at time.
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    void audio.resume();
  } catch {
    audio = null;
  }
}
/** Three short, loud beeps: a whistle you can hear over a pitch. */
function beep() {
  if (!audio) return;
  try {
    const t0 = audio.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'square';
      osc.frequency.value = 1320;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + i * 0.45 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.45 + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0 + i * 0.45);
      osc.stop(t0 + i * 0.45 + 0.34);
    }
  } catch {
    // No sound; the buzz and the screen still say it.
  }
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The match-day clock: whoever runs the day (the organiser, or a captain) picks today's length
 * and taps Start; every phone in the game then counts down from the same moment. The phone that
 * started it buzzes and beeps at time and stays awake while it runs. Scores are still added by
 * hand. `watch` is the players' view: nothing until a clock is running.
 */
export function GameTimer({
  sessionId,
  api,
  onError,
  watch = false,
}: {
  sessionId: string;
  api: TimerApi;
  onError?: (message: string) => void;
  watch?: boolean;
}) {
  const [timer, setTimer] = useState<Timer | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Server time minus this phone's, so a phone with a wrong clock still ends with everyone else.
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const rang = useRef<string | null>(null);
  const canRun = !watch && !!api.save;

  const take = useCallback((t: Timer) => {
    setTimer(t);
    setOffset(Date.parse(t.now) - Date.now());
    // Move the clock on with each answer too: once time's up the tick stops, and this is what
    // lets a watching phone drop "Time's up" a few minutes later.
    setNow(Date.now());
    setFailed(false);
  }, []);

  const load = useCallback(() => {
    api
      .load(sessionId)
      .then(take)
      .catch(() => setFailed(true));
  }, [api, sessionId, take]);

  // Keep up with a clock started on another phone: every 15s, and on coming back to the app.
  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [load]);

  const endsAt = timer?.startedAt ? Date.parse(timer.startedAt) + timer.minutes * 60_000 : null;
  const left = endsAt == null ? null : endsAt - (now + offset);
  const running = left != null && left > 0;
  const up = left != null && left <= 0;
  const mine = !!timer?.startedAt && readMine(sessionId) === timer.startedAt;

  // Tick while it runs.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // At time, on the phone that started it: buzz and beep once (not if it comes back much later).
  useEffect(() => {
    if (!up || !mine || !timer?.startedAt || rang.current === timer.startedAt) return;
    rang.current = timer.startedAt;
    if (left != null && left > -30_000) {
      buzz([500, 150, 500, 150, 900]);
      beep();
    }
  }, [up, mine, timer?.startedAt, left]);

  // Keep the starting phone's screen on while the clock runs, so it's awake to buzz at time.
  // Phones drop the lock whenever the page is hidden (a quick look at WhatsApp), so it's asked
  // for again each time the page comes back.
  useEffect(() => {
    if (!running || !mine || !('wakeLock' in navigator)) return;
    const wakeLock = (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    const ask = () => {
      if (gone || document.visibilityState !== 'visible') return;
      wakeLock
        .request('screen')
        .then((l) => {
          if (gone) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', ask);
      void lock?.release().catch(() => {});
    };
  }, [running, mine]);

  async function change(c: { start?: boolean; minutes?: number }) {
    if (!api.save || !timer) return;
    if (c.start) {
      unlockAudio();
      buzz(12);
    }
    // Show it straight away; the server's answer replaces it.
    const before = timer;
    const startedAt = c.start ? new Date(Date.now() + offset).toISOString() : c.start === false ? null : timer.startedAt;
    setTimer({ ...timer, minutes: c.minutes ?? timer.minutes, startedAt });
    setNow(Date.now());
    if (c.start !== undefined) writeMine(sessionId, startedAt);
    setBusy(true);
    try {
      const t = await api.save(sessionId, c);
      take(t);
      if (c.start !== undefined) writeMine(sessionId, t.startedAt);
    } catch (err) {
      setTimer(before);
      if (c.start !== undefined) writeMine(sessionId, before.startedAt);
      onError?.(err instanceof Error ? err.message : 'The timer didn’t change. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // The group turned the timer off: nothing to show, for anyone.
  if (timer?.on === false) return null;

  // Players watching: only a running clock, or one that just ran out.
  if (watch) {
    if (!timer || left == null || left < -WATCH_UP_MS) return null;
    return (
      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${up ? 'bg-kit-500 text-ink' : 'bg-white/10 text-white'}`}>
        {up ? <span aria-hidden>⏱</span> : <LiveDot />}
        <span className="flex-1 text-[13px] font-bold">{up ? 'Time’s up on this game' : `Game on · ${timer.minutes} min`}</span>
        <span role="timer" aria-label={up ? 'Time’s up' : `${clock(left)} left`} className="font-display text-2xl font-extrabold tabular-nums">
          {up ? '0:00' : clock(left)}
        </span>
      </div>
    );
  }

  if (failed && !timer) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-3xl bg-white border border-gray-200 px-4 py-3">
        <p className="text-[13px] text-gray-600">The timer didn’t load.</p>
        <button onClick={load} className="press min-h-11 px-3 rounded-xl text-[14px] font-bold text-pitch-700 hover:bg-chalk">
          Try again
        </button>
      </div>
    );
  }
  if (!timer) {
    return <div className="h-[76px] rounded-3xl bg-white border border-gray-200 animate-pulse" aria-label="Loading the timer" />;
  }

  const pct = running ? Math.max(0, Math.min(100, (left / (timer.minutes * 60_000)) * 100)) : up ? 0 : 100;
  const small = 'press min-h-11 px-4 rounded-xl text-[14px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

  return (
    <section
      aria-label="Game timer"
      className={`rounded-3xl border p-4 transition-colors ${up ? 'bg-kit-500 border-kit-500 text-ink' : 'bg-white border-gray-200 text-ink'}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-bold ${up ? 'text-ink/80' : 'text-gray-500'}`}>
            {up ? 'Full time on this game' : running ? `Game on · ${timer.minutes} min` : 'Game timer'}
          </p>
          <p role="timer" aria-label={running ? `${clock(left!)} left` : up ? 'Time’s up' : `${timer.minutes} minutes`} className={`font-display leading-none font-extrabold tabular-nums whitespace-nowrap ${up ? 'text-[32px] py-1' : 'text-[40px]'}`}>
            {running ? clock(left!) : up ? 'Time’s up' : `${timer.minutes}:00`}
          </p>
        </div>
        {canRun &&
          (running ? (
            <button onClick={() => change({ start: false })} disabled={busy} className={`${small} bg-white border border-gray-300 text-ink hover:border-ink`}>
              Stop
            </button>
          ) : (
            <button onClick={() => change({ start: true })} disabled={busy} className={`${small} bg-ink text-volt-300 hover:bg-pitch-900`}>
              {busy ? <BallSpinner className="w-4 h-4" /> : <span aria-hidden>▶</span>}
              {up ? 'Next game' : 'Start'}
            </button>
          ))}
      </div>

      {/* The clock running down, so a glance from the touchline says how long is left */}
      <div className={`mt-3 h-2 rounded-full overflow-hidden ${up ? 'bg-ink/15' : 'bg-chalk'}`} aria-hidden>
        <div className={`h-full rounded-full ${running ? 'bg-volt-400' : 'bg-pitch-600'} motion-safe:transition-[width] motion-safe:duration-300`} style={{ width: `${pct}%` }} />
      </div>

      {canRun && !running && (
        <div className="mt-3">
          <p className={`text-[12px] font-bold ${up ? 'text-ink/80' : 'text-gray-500'}`} id={`len-${sessionId}`}>
            Today’s games last
          </p>
          <div className="mt-1.5 flex items-center gap-1.5" role="group" aria-labelledby={`len-${sessionId}`}>
            <button
              type="button"
              aria-label="One minute less"
              disabled={busy || timer.minutes <= 1}
              onClick={() => change({ minutes: timer.minutes - 1 })}
              className="press shrink-0 w-11 h-11 rounded-xl border border-gray-300 bg-white text-ink text-lg font-extrabold disabled:opacity-40"
            >
              −
            </button>
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={timer.minutes === m}
                  disabled={busy}
                  onClick={() => timer.minutes !== m && change({ minutes: m })}
                  className={`press shrink-0 h-11 min-w-11 px-2.5 rounded-xl text-[14px] font-bold tabular-nums border ${
                    timer.minutes === m ? 'bg-ink border-ink text-volt-300' : 'bg-white border-gray-200 text-ink hover:border-ink'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="One minute more"
              disabled={busy || timer.minutes >= 60}
              onClick={() => change({ minutes: timer.minutes + 1 })}
              className="press shrink-0 w-11 h-11 rounded-xl border border-gray-300 bg-white text-ink text-lg font-extrabold disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className={`mt-1.5 text-[12px] leading-snug ${up ? 'text-ink/80' : 'text-gray-500'}`}>
            Everyone in the game sees the clock. This phone buzzes and beeps at time.
          </p>
        </div>
      )}
      {canRun && up && (
        <button onClick={() => change({ start: false })} disabled={busy} className="press mt-2 min-h-11 px-1 text-[14px] font-bold text-ink underline underline-offset-2">
          Clear the clock
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {up ? 'Time’s up on this game.' : ''}
      </p>
    </section>
  );
}
