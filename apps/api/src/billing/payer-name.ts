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
