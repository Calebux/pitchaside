import type { TeamKey } from '@/lib/api';

/** Bib colours for each side. `hex` fills a shirt; `ink` is true when dark text reads on it. */
export const TEAMS: Record<TeamKey, { name: string; swatch: string; soft: string; text: string; hex: string; ink: boolean }> = {
  A: { name: 'Orange', swatch: 'bg-kit-500', soft: 'bg-kit-400/15', text: 'text-white', hex: '#ff6a3d', ink: true },
  B: { name: 'Yellow', swatch: 'bg-sun-400', soft: 'bg-sun-400/20', text: 'text-ink', hex: '#ffc93c', ink: true },
  C: { name: 'Blue', swatch: 'bg-[#3b82f6]', soft: 'bg-[#3b82f6]/10', text: 'text-white', hex: '#3b82f6', ink: false },
  D: { name: 'White', swatch: 'bg-white border border-ink', soft: 'bg-chalk', text: 'text-ink', hex: '#ffffff', ink: true },
  E: { name: 'Green', swatch: 'bg-pitch-500', soft: 'bg-pitch-500/10', text: 'text-white', hex: '#2f8f48', ink: false },
  F: { name: 'Red', swatch: 'bg-[#e5484d]', soft: 'bg-[#e5484d]/10', text: 'text-white', hex: '#e5484d', ink: false },
};

/** A side goes by its captain once it has one ("Team Baba"), else its bib colour. */
export function teamName(team: TeamKey, captains?: Partial<Record<TeamKey, string>>) {
  const captain = captains?.[team];
  return captain ? `Team ${captain}` : TEAMS[team].name;
}
