/** How long a game lasts when the group hasn't said: the usual 5-a-side game at the pitch. */
export const DEFAULT_GAME_MINUTES = 7;

/** The longest game the timer takes, so a typo (70 for 7) can't leave a clock running all day. */
export const MAX_GAME_MINUTES = 60;

export interface GameTimer {
  /** Whether the group uses the timer; off, match day doesn't show it. */
  on: boolean;
  /** Today's game length in minutes: the day's own, else the group's, else 7. */
  minutes: number;
  /** When the running game's clock started; null while it isn't running. */
  startedAt: string | null;
  /** The server's time, so every phone counts down from the same clock. */
  now: string;
}

export function timerOf(session: {
  timerMinutes?: number | null;
  timerStartedAt?: Date | null;
  group?: { gameMinutes?: number | null; timerOn?: boolean | null } | null;
}): GameTimer {
  return {
    on: session.group?.timerOn !== false,
    minutes: session.timerMinutes ?? session.group?.gameMinutes ?? DEFAULT_GAME_MINUTES,
    startedAt: session.timerStartedAt ? new Date(session.timerStartedAt).toISOString() : null,
    now: new Date().toISOString(),
  };
}

/**
 * What a tap on the timer changes: a new length for today, and starting (from now, also over a
 * running clock: the next game) or stopping it. Throws on a length outside 1–60 minutes.
 */
export function timerChange(input: { start?: boolean; minutes?: number }, now = new Date()) {
  const patch: { timerMinutes?: number; timerStartedAt?: Date | null } = {};
  if (input.minutes !== undefined) {
    const m = Math.round(Number(input.minutes));
    if (!Number.isFinite(m) || m < 1 || m > MAX_GAME_MINUTES) throw new Error(`A game lasts 1 to ${MAX_GAME_MINUTES} minutes`);
    patch.timerMinutes = m;
  }
  if (input.start === true) patch.timerStartedAt = now;
  if (input.start === false) patch.timerStartedAt = null;
  return patch;
}
