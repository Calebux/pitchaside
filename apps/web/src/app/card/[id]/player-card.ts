/** Server-side: a player's card behind its share link. */
export type Ability = 'SHO' | 'PAS' | 'TEC' | 'DEF' | 'IQ' | 'PHY' | 'MOV' | 'GK';
type Rank = { rank: number; of: number } | null;

export interface PlayerCardData {
  name: string;
  nickname: string | null;
  photoKey: string | null;
  clubName: string | null;
  groups: string[];
  ovr: number | null;
  /** Fewer than a few scored games: the number is still settling. */
  provisional: boolean;
  attributes: Record<Ability, number | null>;
  /** Match days played. */
  games: number;
  record: { w: number; d: number; l: number };
  points: number;
  goals: number;
  assists: number;
  saves: number;
  potmWins: number;
  viiOfDay: number;
  teamOfDay: number;
  /** Where they rank in the club on each, among everyone who has played. */
  ranks: Partial<Record<'goals' | 'assists' | 'potmWins' | 'points' | 'viiOfDay' | 'wins', Rank>>;
}

const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function getPlayerCard(id: string): Promise<PlayerCardData | null> {
  try {
    // A minute's cache: the page, its link preview and the image all ask for the same card.
    const res = await fetch(`${API_URL}/api/public/players/${encodeURIComponent(id)}/card`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as PlayerCardData) : null;
  } catch {
    return null;
  }
}
