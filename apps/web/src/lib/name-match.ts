/**
 * How closely the name on a bank transfer fits a squad member's name. Banks and players spell
 * names differently ("Rodrick" / "Rodrigue", "Oluwaseun" / "Seun", surname first), so besides an
 * exact fit we spot names that are nearly the same, to suggest them. Suggesting only: the server
 * places a payment by itself on an exact fit and never on a similar one.
 */

const plain = (s?: string | null) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2);

/** The word's consonants, with letters that sound alike folded together: "rodrick" and "rodrigue" both give "rdrk". */
function skeleton(w: string) {
  const s = w
    .replace(/ph/g, 'f')
    .replace(/(ck|c|q|g|x)/g, 'k')
    .replace(/[yw]/g, '');
  return (s[0] + s.slice(1).replace(/[aeiou]/g, '')).replace(/(.)\1+/g, '$1').replace(/e$/, '');
}

/** Edits to turn one word into the other (Levenshtein). */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

/** Nearly the same word: a short form of it ("Seun" in "Oluwaseun"), a typo or two, or the same sound. */
function close(a: string, b: string) {
  if (a === b) return true;
  // A short form: the start of it ("Ade" for "Adewale") or, from four letters, the end ("Seun" for "Oluwaseun").
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.endsWith(b) || b.endsWith(a))) return true;
  if (distance(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1)) return true;
  return Math.min(a.length, b.length) >= 4 && skeleton(a) === skeleton(b);
}

/**
 * 'exact' when every word of the member's name is in what the bank said, 'similar' when every word
 * is there or nearly there, otherwise null. `hits` counts exact words, for ordering.
 */
export function nameFit(memberName: string, said: string): { fit: 'exact' | 'similar' | null; hits: number } {
  const theirs = plain(said);
  const mine = plain(memberName);
  if (!mine.length || !theirs.length) return { fit: null, hits: 0 };
  const hits = mine.filter((w) => theirs.includes(w)).length;
  if (hits === mine.length) return { fit: 'exact', hits };
  const nearly = mine.every((w) => theirs.some((t) => close(w, t)));
  return { fit: nearly ? 'similar' : null, hits };
}
