/**
 * The sender's name for matching a transfer to a member. The bank's sender field when it's
 * there; otherwise the name some banks put only in the narration, e.g. "Transfer from DAVID
 * OREKOYA" or "TRF FROM SEGUN JOHN/0123". Anything after the name (a "to …", a reference,
 * a slash or a dash) is left off.
 */
export function payerNameFrom(senderName?: string | null, narration?: string | null): string | null {
  if (senderName?.trim()) return senderName;
  const m = narration?.match(/\b(?:transfer|trf|trsf|tfr)\s+from\s+([a-z][a-z .']*?)(?=\s+(?:to|for|ref|via)\b|\s*[/|:,\-–]|\s*\d|$)/i);
  const name = m?.[1].trim();
  return name && name.split(/\s+/).length >= 2 ? name : null;
}

/** A player's payment code in a narration: "PA7K3FQ", "PA-7K3FQ", "pa 7k3fq". */
export const REF_PATTERN = /\bPA[- ]?([A-HJ-NP-Z2-9]{5})\b/i;

export function normaliseName(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);
}

export interface MemberLike {
  playerId: string;
  paymentRef?: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Which member sent a transfer, when it's certain: their payment code is in the narration, or
 * every word of exactly one member's first and last name is in the sender's name. Otherwise null,
 * and a person decides.
 */
export function whoSent(members: MemberLike[], senderName?: string | null, narration?: string | null): string | null {
  const refMatch = narration?.toUpperCase().match(REF_PATTERN);
  if (refMatch) {
    const m = members.find((x) => x.paymentRef === `PA${refMatch[1].toUpperCase()}`);
    if (m) return m.playerId;
  }
  const name = payerNameFrom(senderName, narration);
  if (!name) return null;
  const words = new Set(normaliseName(name));
  const candidates = members.filter((m) => [...normaliseName(m.firstName), ...normaliseName(m.lastName)].every((w) => words.has(w)));
  return candidates.length === 1 ? candidates[0].playerId : null;
}
