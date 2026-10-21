import { formatCurrency, type OwedItem } from './api';
import { daysFromToday } from '@/components/money-card';

/** A squad member as matching needs them. `credit` is money they've paid in that hasn't gone on a game yet. */
export interface MatchMember {
  playerId: string;
  name: string;
  nickname?: string | null;
  photoKey?: string | null;
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
 * anything they'd already paid in and pays their oldest unpaid games while it covers a whole one,
 * but only games already played and their one next game. The rest waits towards the next game
 * they owe (a part payment) or, when that's everything they owe now, as extra for the organiser to
 * sort. Returned as the short line the sheet shows and the confirmation the toast shows.
 */
export function describeGive(amount: number, member: MatchMember, owed: OwedItem[], payFirst?: OwedItem) {
  const first = member.name.split(' ')[0];
  let pool = member.credit + amount;
  const paid: OwedItem[] = [];
  // The game the organiser picked is paid first when the money covers it, wherever it falls.
  if (payFirst && amount + 0.001 >= payFirst.amount) {
    pool -= payFirst.amount;
    paid.push(payFirst);
  }
  const theirs = payableNow(owed.filter((o) => o.playerId === member.playerId && o !== payFirst));
  for (const o of theirs) {
    if (pool + 0.001 < o.amount) break;
    pool -= o.amount;
    paid.push(o);
  }
  const next = theirs.find((o) => !paid.includes(o));
  // Naira only: a few kobo left over isn't worth a line.
  const extraRaw = next ? 0 : Math.min(amount, Math.max(0, pool));
  const extra = Math.round(extraRaw) >= 1 ? Math.round(extraRaw * 100) / 100 : 0;
  const keptRaw = pool - extraRaw;
  const kept = Math.round(keptRaw) >= 1 ? Math.round(keptRaw * 100) / 100 : 0;
  const stillOwes = theirs.filter((o) => !paid.includes(o)).reduce((s, o) => s + o.amount, 0) - kept;
  const owesWhat = theirs.filter((o) => !paid.includes(o)).length > 1 ? 'in total' : `for ${next ? owedLabel(next) : ''}`;
  const owesLine = next ? `${first} still owes ${formatCurrency(stillOwes)} ${owesWhat}.` : null;
  // The same outcome, short: "Pays Sat 17 Oct. ₦1,500 extra, for you to sort".
  const parts = (pays: string, toward: string, nothing: string) => [
    paid.length ? `${pays} ${listOf(paid)}` : next ? `${toward} ${owedLabel(next)}` : nothing,
    // "Goes towards Sat 17 Oct" already names the game: don't say it twice.
    next && !paid.length && theirs.length === 1
      ? `${first} still owes ${formatCurrency(stillOwes)}`
      : next
        ? owesLine?.slice(0, -1)
        : paid.length && extra > 0
          ? `${formatCurrency(extra)} extra, for you to sort`
          : null,
  ];
  const brief = parts('Pays', 'Goes towards', `${first} owes nothing now, so it waits as extra for you to sort`).filter(Boolean).join('. ');
  const toast = `${formatCurrency(amount)} given to ${member.name}. ${parts('Paid', 'Went towards', 'It waits as extra to sort').filter(Boolean).join('. ')}.`;
  return { paid, kept, extra, brief, toast };
}

/** The games money can pay now, like the server: played (or today's) and the one next game. */
function payableNow(items: OwedItem[]) {
  let next = false;
  return [...items]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .filter((o) => {
      if (daysFromToday(String(o.date)) <= 0) return true;
      if (next) return false;
      next = true;
      return true;
    });
}

/**
 * Using a transfer for one particular unpaid game (marking it paid from the game page). The server
 * pays that game first when the money covers it, then treats the rest like any other money:
 * oldest unpaid games, then kept. Less than the game goes in as kept money, which pays their oldest
 * game once it covers one.
 */
export function describeUse(amount: number, paymentId: string, member: MatchMember, owed: OwedItem[]) {
  const chosen = owed.find((o) => o.playerId === member.playerId && o.paymentId === paymentId);
  return describeGive(amount, member, owed, chosen);
}
