import type { BibColour, Bibs, BibSides } from '@pitchaside/shared';

/**
 * The colours the app offers (BIB_COLOURS in @pitchaside/shared). Listed here because the server
 * only takes types from that package at run time; bibs.spec checks the two lists match.
 */
export const BIB_COLOUR_KEYS: readonly BibColour[] = [
  'orange', 'yellow', 'blue', 'white', 'green', 'red', 'black', 'sky', 'navy', 'maroon', 'pink', 'purple', 'grey', 'lime',
];
/** Same as TEAM_NAME_MAX in @pitchaside/shared. */
export const TEAM_NAME_MAX = 20;

const SIDES: BibSides[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * An organiser's bibs, made safe to store: only sides A–F, only colours from the list, names
 * trimmed to TEAM_NAME_MAX (blank means no name). Nothing left (or null) clears them, so the
 * defaults apply. Throws on a colour that isn't on the list, so a typo can't save as no colour.
 */
export function cleanBibs(input: unknown): Bibs | null {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Bibs must be a side-by-side list');
  const out: Bibs = {};
  for (const side of SIDES) {
    const raw = (input as Record<string, unknown>)[side] as { colour?: unknown; name?: unknown } | undefined;
    if (!raw) continue;
    if (typeof raw.colour !== 'string' || !BIB_COLOUR_KEYS.includes(raw.colour as BibColour)) throw new Error(`Pick a colour from the list for team ${side}`);
    const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ').slice(0, TEAM_NAME_MAX) : '';
    out[side] = { colour: raw.colour as BibColour, ...(name ? { name } : {}) };
  }
  return Object.keys(out).length ? out : null;
}

/** The bibs a game is played in: its own for the day, else its group's, else none (defaults). */
export function bibsFor(session: { bibs?: Bibs | null; group?: { bibs?: Bibs | null } | null }): Bibs {
  return session.bibs ?? session.group?.bibs ?? {};
}
