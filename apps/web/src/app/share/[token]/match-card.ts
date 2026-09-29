/** Server-side: the match-day summary behind the share card and its page. */
export interface MatchCard {
  groupName: string;
  clubName: string | null;
  date: string;
  open: boolean;
  ballots: number;
  squadSize: number;
  awards: { key: string; title: string; name: string; votes: number; shared: boolean }[];
  teamOfTheDay: { team: string; players: string[]; w: number; d: number; l: number; pts: number } | null;
  standings: { team: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }[];
  games: { teamA: string; teamB: string; scoreA: number; scoreB: number }[];
}

const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function getMatchCard(token: string): Promise<MatchCard | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/votes/${encodeURIComponent(token)}/card`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as MatchCard) : null;
  } catch {
    return null;
  }
}
