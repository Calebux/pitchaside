'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { kitFor } from '@/components/illustrations';
import { senderFrom } from '@/components/home/transfers-sheet';
import { formatCurrency, type BankTransfer, type OwedItem } from '@/lib/api';

/** A squad member as the picker needs them. `credit` is money they've paid in that hasn't covered a game yet. */
export interface MatchMember {
  playerId: string;
  name: string;
  nickname?: string | null;
  credit: number;
}

const words = (s?: string | null) => (s ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);

/** "Sat 17 Oct" for a game, "October 2026 dues" for a dues period. */
export function owedLabel(o: OwedItem) {
  if (o.kind === 'dues' && o.label) return `${o.label} dues`;
  const [y, m, d] = String(o.date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/**
 * Where money given to a player ends up, worked out the same way the server does it: it's added to
 * anything they'd already paid in, pays their oldest unpaid games while it covers a whole one, and
 * the rest is kept for their next game. Said in plain words for the organiser, before and after.
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
  const kept = Math.round(pool * 100) / 100;
  const stillOwed = theirs.filter((o) => !paid.includes(o));
  const lines: string[] = [];
  if (paid.length) lines.push(`Pays ${paid.map((o) => `${owedLabel(o)} (${formatCurrency(o.amount)})`).join(' and ')}.`);
  if (!theirs.length) {
    lines.push(`${first} doesn't owe anything right now, so all of it is kept for ${first}'s next game.`);
  } else if (!paid.length) {
    lines.push(`It isn't enough for a whole game yet (${formatCurrency(theirs[0].amount)} for ${owedLabel(theirs[0])}), so it's kept until ${first} pays the rest.`);
  } else if (kept > 0) {
    lines.push(`${formatCurrency(kept)} is left over and kept for ${first}'s next game.`);
  }
  if (member.credit > 0 && theirs.length) lines.push(`That includes ${formatCurrency(member.credit)} ${first} had already paid in.`);
  if (member.credit > 0 && !theirs.length) lines.push(`With the ${formatCurrency(member.credit)} ${first} had already paid in, ${formatCurrency(kept)} is waiting for the next game.`);
  if (paid.length && stillOwed.length) {
    const left = stillOwed.reduce((s, o) => s + o.amount, 0);
    lines.push(`${first} still owes ${formatCurrency(left)} for ${stillOwed.length === 1 ? owedLabel(stillOwed[0]) : `${stillOwed.length} games`}.`);
  }
  const toast = paid.length
    ? `${formatCurrency(amount)} given to ${member.name}. Paid ${paid.map(owedLabel).join(' and ')}${kept > 0 ? `; ${formatCurrency(kept)} kept for their next game` : ''}.`
    : `${formatCurrency(amount)} given to ${member.name}. Kept for their next game.`;
  return { paid, kept, lines, toast };
}

/** How sure we are a member sent this: they said "I've paid" for it, or the bank's name is theirs. */
function likeliness(t: BankTransfer, m: MatchMember) {
  const said = new Set([...words(senderFrom(t)), ...words(t.narration)]);
  const mine = words(m.name);
  const hits = mine.filter((w) => said.has(w)).length;
  const claimed = (t.claims ?? []).some((c) => c.player.id === m.playerId);
  const reasons: string[] = [];
  if (mine.length && hits === mine.length) reasons.push('Name matches');
  if (claimed) reasons.push('Said they’ve paid');
  return { score: (reasons.length ? 10 : 0) + hits, reasons };
}

/**
 * Giving an unknown transfer to someone in the squad. Everyone is listed and searchable: whoever
 * the bank's name or an "I've paid" points to first, then people who owe, then everyone else.
 * The footer says exactly what will happen to the money before it's confirmed.
 */
export function MatchPlayerSheet({
  transfer,
  members,
  owed,
  busy,
  onClose,
  onGive,
}: {
  transfer: BankTransfer;
  members: MatchMember[];
  owed: OwedItem[];
  busy: boolean;
  onClose: () => void;
  onGive: (m: MatchMember, toast: string) => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const amount = Number(transfer.amount);
  const q = query.trim().toLowerCase();
  const rows = members
    .filter((m) => !q || `${m.name} ${m.nickname ?? ''}`.toLowerCase().includes(q))
    .map((m) => {
      const theirs = owed.filter((o) => o.playerId === m.playerId);
      return { m, theirs, ...likeliness(transfer, m) };
    })
    .sort((a, b) => b.score - a.score || Number(b.theirs.length > 0) - Number(a.theirs.length > 0) || a.m.name.localeCompare(b.m.name));
  const likely = rows.filter((r) => r.reasons.length);
  const owing = rows.filter((r) => !r.reasons.length && r.theirs.length);
  const rest = rows.filter((r) => !r.reasons.length && !r.theirs.length);
  const choice = members.find((m) => m.playerId === picked) ?? null;
  const outcome = choice ? describeGive(amount, choice, owed) : null;
  const sender = senderFrom(transfer);

  const section = (title: string, list: typeof rows) =>
    list.length > 0 && (
      <section key={title} className="mt-4">
        <h3 className="mb-1 text-[13px] font-bold text-gray-600">{title}</h3>
        <ul className="-mx-2" role="radiogroup" aria-label={title}>
          {list.map(({ m, theirs, reasons }) => {
            const on = picked === m.playerId;
            const total = theirs.reduce((s, o) => s + o.amount, 0);
            const kit = kitFor(m.name);
            return (
              <li key={m.playerId}>
                <button
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(m.playerId)}
                  className={`press w-full flex items-center gap-3 min-h-14 px-2 py-2 rounded-xl text-left transition-colors ${on ? 'bg-volt-300/50' : 'hover:bg-chalk'}`}
                >
                  <span className={`w-9 h-9 shrink-0 rounded-full ${kit.bg} ${kit.fg} text-sm font-extrabold font-display flex items-center justify-center`} aria-hidden>
                    {m.name.charAt(0)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-ink truncate">
                      {m.name}
                      {m.nickname ? <span className="font-semibold text-gray-500"> “{m.nickname}”</span> : null}
                    </span>
                    <span className="block text-[13px] text-gray-600 truncate">
                      {reasons.length > 0 && <span className="font-bold text-pitch-600">{reasons.join(', ')}. </span>}
                      {theirs.length === 0
                        ? 'Owes nothing right now'
                        : theirs.length === 1
                          ? `Owes ${formatCurrency(total)} for ${owedLabel(theirs[0])}`
                          : `Owes ${formatCurrency(total)} for ${theirs.length} games`}
                    </span>
                  </span>
                  <span
                    className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${on ? 'border-ink bg-ink' : 'border-gray-300'}`}
                    aria-hidden
                  >
                    {on && <span className="w-2 h-2 rounded-full bg-volt-300" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        <div>
          {choice && outcome && (
            <div className="mb-3 rounded-2xl bg-chalk px-3.5 py-3 text-[13px] leading-snug text-ink" aria-live="polite">
              <p className="font-bold">
                All {formatCurrency(amount)} goes to {choice.name}
              </p>
              <ul className="mt-1 space-y-0.5 text-gray-700">
                {outcome.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            disabled={!choice || busy}
            onClick={() => choice && outcome && onGive(choice, outcome.toast)}
            className="w-full h-12 rounded-2xl bg-ink text-volt-300 text-[15px] font-extrabold hover:bg-pitch-900 disabled:opacity-40 transition-colors"
          >
            {choice ? `Give ${formatCurrency(amount)} to ${choice.name.split(' ')[0]}` : 'Pick who sent it'}
          </button>
        </div>
      }
    >
      <SheetTitle
        id={titleId}
        title={`Who sent ${formatCurrency(amount)}?`}
        sub={`${sender ? `From ${sender}` : 'The bank didn’t say who sent it'}. Pick the player; the whole amount goes to them.`}
        onClose={onClose}
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the squad"
        aria-label="Search the squad"
        className="mt-4 w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600"
      />
      {section('Most likely', likely)}
      {section('Owe money', owing)}
      {section(likely.length || owing.length ? 'Everyone else in the squad' : 'The squad', rest)}
      {rows.length === 0 && <p className="mt-6 text-sm text-gray-600 text-center">No one in the squad is called that.</p>}
    </Sheet>
  );
}
