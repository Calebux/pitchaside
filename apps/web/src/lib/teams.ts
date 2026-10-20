import type { CSSProperties } from 'react';
import { BIB_COLOURS, DEFAULT_BIBS, type Bibs } from '@pitchaside/shared';
import type { TeamKey } from '@/lib/api';

/**
 * The sides, A–F, in their default bibs. Use `bibOf` / `teamName` with a game's `bibs` for what
 * they actually wear and are called; this is only the list of sides and the fallback.
 */
export const TEAMS: Record<TeamKey, { name: string; hex: string; ink: boolean }> = Object.fromEntries(
  (Object.keys(DEFAULT_BIBS) as TeamKey[]).map((k) => {
    const c = BIB_COLOURS[DEFAULT_BIBS[k].colour];
    return [k, { name: c.label, hex: c.hex, ink: c.ink }];
  }),
) as Record<TeamKey, { name: string; hex: string; ink: boolean }>;

/** What a side wears in a game: its colour (label, hex, whether dark text reads on it) and any name. */
export function bibOf(team: TeamKey, bibs?: Bibs | null) {
  const bib = bibs?.[team] ?? DEFAULT_BIBS[team];
  const colour = BIB_COLOURS[bib.colour] ?? BIB_COLOURS[DEFAULT_BIBS[team].colour];
  return { colour: bib.colour, label: colour.label, hex: colour.hex, ink: colour.ink, name: bib.name ?? null };
}

/**
 * What a side is called: the name the organiser gave it ("Red Devils"), else its captain's
 * ("Team Baba"), else its bib colour ("Orange").
 */
export function teamName(team: TeamKey, captains?: Partial<Record<TeamKey, string>>, bibs?: Bibs | null) {
  const bib = bibOf(team, bibs);
  if (bib.name) return bib.name;
  const captain = captains?.[team];
  return captain ? `Team ${captain}` : bib.label;
}

/**
 * A side's colour as a fill, with an outline where it would vanish: dark on white for white
 * bibs, faint white for black ones so they still show on the dark match-day cards.
 */
export function bibFill(team: TeamKey, bibs?: Bibs | null): CSSProperties {
  const bib = bibOf(team, bibs);
  const ring = bib.colour === 'white' ? 'inset 0 0 0 1px #111a14' : bib.colour === 'black' ? 'inset 0 0 0 1.5px rgba(255,255,255,0.55)' : undefined;
  return { backgroundColor: bib.hex, boxShadow: ring };
}

/** The same colour, faint, behind a side's column. */
export function bibTint(team: TeamKey, bibs?: Bibs | null): CSSProperties {
  return { backgroundColor: `${bibOf(team, bibs).hex}1f` };
}
