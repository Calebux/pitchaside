import type { KeeperPref, MatchPlan } from '@pitchaside/shared';

/** What a player can say about going in goal (null: they don't mind). */
export const KEEPER_PREFS: readonly Exclude<KeeperPref, null>[] = ['happy', 'rather_not'];

/** Longest booking the plan takes: a whole afternoon. */
export const MAX_PITCH_MINUTES = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function whole(value: unknown, min: number, max: number, what: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${what} must be ${min} to ${max}`);
  return n;
}

/**
 * An organiser's plan, made safe to store: whole minutes in range, and who left early only by
 * player id. The games and swaps are worked out from it on each phone, so nothing else is kept.
 */
export function cleanPlan(input: unknown): MatchPlan {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The plan is missing');
  const raw = input as Record<string, unknown>;
  const pitchMinutes = whole(raw.pitchMinutes, 10, MAX_PITCH_MINUTES, 'The booking');
  const gameMinutes = whole(raw.gameMinutes, 1, 60, 'A game');
  if (gameMinutes > pitchMinutes) throw new Error('A game can’t be longer than the booking');
  const plan: MatchPlan = {
    pitchMinutes,
    gameMinutes,
    onPitch: whole(raw.onPitch, 2, 11, 'Players on the pitch'),
    swapMinutes: raw.swapMinutes == null ? 0 : whole(raw.swapMinutes, 0, 30, 'Swaps'),
  };
  const away = cleanAway(raw.away, pitchMinutes);
  if (away) plan.away = away;
  return plan;
}

function cleanAway(input: unknown, pitchMinutes: number) {
  if (input == null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Who left early must be a list');
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(input as Record<string, unknown>)) {
    if (!UUID.test(id)) throw new Error('That player isn’t in this game');
    out[id] = whole(at, 0, pitchMinutes, 'When they left');
  }
  return Object.keys(out).length ? out : undefined;
}

/** The plan with a player marked as gone from `at` minutes after kick-off, or back (null). */
export function withAway(plan: MatchPlan, playerId: string, at: number | null): MatchPlan {
  const away = { ...(plan.away ?? {}) };
  if (at === null) delete away[playerId];
  else away[playerId] = whole(at, 0, plan.pitchMinutes, 'When they left');
  const next: MatchPlan = { ...plan };
  if (Object.keys(away).length) next.away = away;
  else delete next.away;
  return next;
}

/** The plan with everyone's goal choice as it is now, kept for the rest of the day (see MatchPlan.keepers). */
export function withKeepers(plan: MatchPlan, players: { id: string; keeper?: KeeperPref }[]): MatchPlan {
  const keepers: Record<string, Exclude<KeeperPref, null>> = {};
  for (const p of players) if (p.keeper === 'happy' || p.keeper === 'rather_not') keepers[p.id] = p.keeper;
  return { ...plan, keepers };
}
