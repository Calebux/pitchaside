import type { TeamKey } from '@/lib/api';

/** Bib colours for each side. */
export const TEAMS: Record<TeamKey, { name: string; swatch: string; soft: string; text: string }> = {
  A: { name: 'Orange', swatch: 'bg-kit-500', soft: 'bg-kit-400/15', text: 'text-white' },
  B: { name: 'Yellow', swatch: 'bg-sun-400', soft: 'bg-sun-400/20', text: 'text-ink' },
  C: { name: 'Blue', swatch: 'bg-[#3b82f6]', soft: 'bg-[#3b82f6]/10', text: 'text-white' },
  D: { name: 'White', swatch: 'bg-white border border-ink', soft: 'bg-chalk', text: 'text-ink' },
  E: { name: 'Green', swatch: 'bg-pitch-500', soft: 'bg-pitch-500/10', text: 'text-white' },
  F: { name: 'Red', swatch: 'bg-[#e5484d]', soft: 'bg-[#e5484d]/10', text: 'text-white' },
};

/** A side goes by its captain once it has one ("Team Baba"), else its bib colour. */
export function teamName(team: TeamKey, captains?: Partial<Record<TeamKey, string>>) {
  const captain = captains?.[team];
  return captain ? `Team ${captain}` : TEAMS[team].name;
}
