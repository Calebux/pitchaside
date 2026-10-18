import { formatCurrency, type OwedItem } from './api';

/** A squad member as matching needs them. `credit` is money they've paid in that hasn't gone on a game yet. */
export interface MatchMember {
  playerId: string;
  name: string;
  nickname?: string | null;
  credit: number;
}

/** "Sat 17 Oct" for a game, "October 2026 dues" for a dues period. */
export function owedLabel(o: OwedItem) {
  if (o.kind === 'dues' && o.label) return `${o.label} dues`;
  const [y, m, d] = String(o.date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/** "Sat 17 Oct", "Sat 17 Oct and Sat 24 Oct", "3 games". */
function listOf(items: OwedItem[]) {
  if (items.length > 2) return `${items.length} ${items.every((o) => o.kind === 'dues') ? 'dues' : 'games'}`;
  return items.map(owedLabel).join(' and ');
}

/**
 * Where money given to a player ends up, worked out the same way the server does it: it's added to
 * anything they'd already paid in, pays their oldest unpaid games while it covers a whole one, and
 * the rest waits, towards the next game they owe or, if they owe nothing, for their next game.
 * Returned as the short line the sheet shows and the confirmation the toast shows.
 */
export function describeGive(amount: number, member: MatchMember, owed: OwedItem[]) {
  const first = member.name.split(' ')[0];
  const theirs = owed.filter((o) => o.playerId === member.playerId);
  let pool = member.credit + amount;
  const paid: OwedItem[] = [];
  for (const o of theirs) {
    if (pool + 0.001 < o.amount) break;
    pool -= o.amount;
    paid.push(o);
  }
  // Naira only: a few kobo left over isn't worth a line.
  const kept = Math.round(pool) >= 1 ? Math.round(pool * 100) / 100 : 0;
  const next = theirs.find((o) => !paid.includes(o));
  const stillOwes = theirs.filter((o) => !paid.includes(o)).reduce((s, o) => s + o.amount, 0) - kept;
  const owesWhat = theirs.length - paid.length > 1 ? 'in total' : `for ${next ? owedLabel(next) : ''}`;
  const owesLine = next ? `${first} still owes ${formatCurrency(stillOwes)} ${owesWhat}.` : null;
  // The same outcome, short: "Pays Sat 17 Oct, ₦25 kept for next game".
  const parts = (pays: string, toward: string, nothing: string) => [
    paid.length ? `${pays} ${listOf(paid)}` : next ? `${toward} ${owedLabel(next)}` : nothing,
    // "Goes towards Sat 17 Oct" already names the game: don't say it twice.
    next && !paid.length && theirs.length === 1
      ? `${first} still owes ${formatCurrency(stillOwes)}`
      : next
        ? owesLine?.slice(0, -1)
        : paid.length && kept > 0
          ? `${formatCurrency(kept)} kept for next game`
          : null,
  ];
  const brief = parts('Pays', 'Goes towards', `${first} owes nothing, so it’s kept for next game`).filter(Boolean).join('. ');
  const toast = `${formatCurrency(amount)} given to ${member.name}. ${parts('Paid', 'Went towards', 'Kept for next game').filter(Boolean).join('. ')}.`;
  return { paid, kept, brief, toast };
}

/**
 * Using a transfer for one particular unpaid game (marking it paid from the game page). The server
 * pays that game first when the money covers it, then treats the rest like any other money:
 * oldest unpaid games, then kept. Less than the game goes in as kept money, which pays their oldest
 * game once it covers one.
 */
export function describeUse(amount: number, paymentId: string, member: MatchMember, owed: OwedItem[]) {
  const theirs = owed.filter((o) => o.playerId === member.playerId);
  const chosen = theirs.find((o) => o.paymentId === paymentId);
  const order = chosen && amount + 0.001 >= chosen.amount ? [chosen, ...theirs.filter((o) => o !== chosen)] : theirs;
  return describeGive(amount, member, order);
}
