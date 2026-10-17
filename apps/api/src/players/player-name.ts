/** A nickname as stored: trimmed, and blank means none. */
export function cleanNickname(nickname: string | null | undefined): string | null {
  return nickname?.trim() || null;
}

/** What a player goes by on a team sheet: their nickname, else their full name. */
export function sheetName(p: { firstName: string; lastName: string; nickname?: string | null }) {
  return p.nickname || `${p.firstName} ${p.lastName}`.trim();
}

/** What teammates shout on the pitch: their nickname, else their first name. */
export function pitchName(p: { firstName: string; nickname?: string | null }) {
  return p.nickname || p.firstName;
}
