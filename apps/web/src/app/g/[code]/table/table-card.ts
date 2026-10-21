/** Server-side: a group's table behind its share link (the group's join-link code). */
export interface TableCard {
  groupName: string;
  clubName: string | null;
  /** Match days the table counts. */
  games: number;
  /** Only the latest N match days, when the table was shared that way. */
  last: number | null;
  lastDate: string | null;
  points: { win: number; draw: number; teamOfDay: number; potm: number };
  /** Everyone in the table; `rows` is the top ten. */
  total: number;
  rows: {
    id: string;
    name: string;
    short: string;
    /** Their real name and nickname, kept apart (newer servers only). */
    fullName?: string;
    nickname?: string | null;
    photoKey: string | null;
    /** The photo itself, loaded before drawing (see loadPhotos). */
    photo?: string | null;
    points: number;
    games: number;
    w: number;
    d: number;
    l: number;
    potmWins: number;
    /** Times on the Team of the Day (newer servers only). */
    teamOfDay?: number;
    form: ('W' | 'D' | 'L')[];
    move: number | null;
    ovr: number | null;
  }[];
}

export const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function getTableCard(code: string, last?: number | null): Promise<TableCard | null> {
  try {
    const q = last ? `?last=${last}` : '';
    // A minute's cache: the page, its link preview and the image all ask for the same table.
    const res = await fetch(`${API_URL}/api/public/groups/${encodeURIComponent(code)}/table${q}`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as TableCard) : null;
  } catch {
    return null;
  }
}

/** `?last=5` from a shared link, kept to sensible values. */
export function lastOf(value: string | string[] | null | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n <= 52 ? n : null;
}
