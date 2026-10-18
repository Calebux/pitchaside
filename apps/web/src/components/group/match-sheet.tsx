'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary } from '@/components/buttons';
import { kitFor } from '@/components/illustrations';
import { senderFrom } from '@/components/home/transfers-sheet';
import { formatCurrency, type BankTransfer, type OwedItem } from '@/lib/api';

/** A squad member as the picker needs them. `credit` is money they've paid in that hasn't gone on a game yet. */
export interface MatchMember {
  playerId: string;
  name: string;
  nickname?: string | null;
  credit: number;
}

const words = (s?: string | null) => (s ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
const firstName = (m: MatchMember) => m.name.split(' ')[0];

/** "Sat 17 Oct" for a game, "October 2026 dues" for a dues period. */
export function owedLabel(o: OwedItem) {
  if (o.kind === 'dues' && o.label) return `${o.label} dues`;
  const [y, m, d] = String(o.date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/**
 * Where money given to a player ends up, worked out the same way the server does it: it's added to
 * anything they'd already paid in, pays their oldest unpaid games while it covers a whole one, and
 * the rest is kept for their next game. Returned as receipt rows and as plain sentences.
 */
export function describeGive(amount: number, member: MatchMember, owed: OwedItem[]) {
  const first = firstName(member);
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
  const owedLeft = stillOwed.reduce((s, o) => s + o.amount, 0);
  const rows = [
    ...paid.map((o) => ({ label: o.kind === 'dues' ? owedLabel(o) : `${owedLabel(o)} game`, amount: o.amount, kept: false })),
    ...(kept > 0 ? [{ label: 'Kept for next game', amount: kept, kept: true }] : []),
  ];
  const owesLine = stillOwed.length
    ? `${first} still owes ${formatCurrency(owedLeft)} for ${stillOwed.length === 1 ? owedLabel(stillOwed[0]) : `${stillOwed.length} games`}.`
    : null;
  const brief = paid.length
    ? `Pays ${paid.map(owedLabel).join(' and ')}${kept > 0 ? `, keeps ${formatCurrency(kept)} for next game` : ''}`
    : theirs.length
      ? `Not enough for ${owedLabel(theirs[0])} yet, so it’s kept`
      : `${first} owes nothing, so it’s kept for next game`;
  const toast = paid.length
    ? `${formatCurrency(amount)} given to ${member.name}. Paid ${paid.map(owedLabel).join(' and ')}${kept > 0 ? `; ${formatCurrency(kept)} kept for their next game` : ''}.`
    : `${formatCurrency(amount)} given to ${member.name}. Kept for their next game.`;
  return { paid, kept, rows, owesLine, brief, toast, owesAny: theirs.length > 0 };
}

/** Why a member might have sent this: the bank's name is theirs, or they tapped "I've paid" for it. */
function likeliness(t: BankTransfer, m: MatchMember) {
  const said = new Set([...words(senderFrom(t)), ...words(t.narration)]);
  const mine = words(m.name);
  const hits = mine.filter((w) => said.has(w)).length;
  const named = mine.length > 0 && hits === mine.length;
  const claimed = (t.claims ?? []).some((c) => c.player.id === m.playerId);
  const reason = named && claimed ? 'Name matches, said they’ve paid' : named ? 'Name on the transfer matches' : claimed ? 'Said they’ve paid' : null;
  return { score: (named ? 20 : 0) + (claimed ? 10 : 0) + hits, reason, named, claimed };
}

/**
 * The one member this transfer most likely came from, when there's a clear answer: the only member
 * whose full name is on it, or else the only player who said they'd paid about this much then.
 */
export function bestGuess(t: BankTransfer, members: MatchMember[]) {
  const scored = members.map((m) => ({ m, ...likeliness(t, m) }));
  const named = scored.filter((s) => s.named);
  if (named.length) return named.length === 1 ? named[0] : null;
  const claimed = scored.filter((s) => s.claimed);
  return claimed.length === 1 ? claimed[0] : null;
}

export function MemberAvatar({ name, className = 'w-10 h-10 text-sm' }: { name: string; className?: string }) {
  const kit = kitFor(name);
  return (
    <span className={`${className} shrink-0 rounded-full ${kit.bg} ${kit.fg} font-extrabold font-display flex items-center justify-center`} aria-hidden>
      {name.charAt(0)}
    </span>
  );
}

/** The receipt: where every naira of the transfer goes, before it's confirmed. */
function GiveReceipt({ amount, member, owed }: { amount: number; member: MatchMember; owed: OwedItem[] }) {
  const out = describeGive(amount, member, owed);
  const first = firstName(member);
  const notes = [
    !out.paid.length &&
      (out.owesAny ? `Not enough for a whole game yet. It pays the next one once ${first} sends the rest.` : `${first} owes nothing right now. It pays the next game by itself.`),
  ].filter(Boolean);
  return (
    <div className="rounded-3xl bg-ink px-4 pt-3.5 pb-3.5" aria-live="polite">
      <p className="text-[13px] text-white/60 truncate">
        {formatCurrency(amount)} to <span className="font-bold text-white">{member.name}</span>
      </p>
      {member.credit > 0 && (
        <p className="mt-1 text-[13px] text-white/60">
          With {formatCurrency(member.credit)} {first} already had, that’s {formatCurrency(member.credit + amount)}:
        </p>
      )}
      <dl className="mt-2.5 space-y-1.5">
        {out.rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[15px] font-semibold text-white">{r.label}</dt>
            <dd className={`font-display text-[15px] font-extrabold tabular-nums ${r.kept ? 'text-volt-300' : 'text-white'}`}>{formatCurrency(r.amount)}</dd>
          </div>
        ))}
      </dl>
      {(notes.length > 0 || out.owesLine) && (
        <p className="mt-3 pt-2.5 border-t border-white/10 text-[13px] leading-snug text-white/60">
          {notes.join(' ')}
          {out.owesLine && <span className="block text-sun-400 font-semibold">{out.owesLine}</span>}
        </p>
      )}
    </div>
  );
}

/**
 * Giving a transfer to someone in the squad. Everyone is listed and searchable: whoever the bank's
 * name or an "I've paid" points to first, then people who owe, then everyone else. A receipt says
 * where the money goes before it's confirmed.
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
      return { m, theirs, total: theirs.reduce((s, o) => s + o.amount, 0), ...likeliness(transfer, m) };
    })
    .sort((a, b) => b.score - a.score || b.total - a.total || a.m.name.localeCompare(b.m.name));
  const likely = rows.filter((r) => r.reason);
  const owing = rows.filter((r) => !r.reason && r.theirs.length);
  const rest = rows.filter((r) => !r.reason && !r.theirs.length);
  const choice = members.find((m) => m.playerId === picked) ?? null;
  const sender = senderFrom(transfer);
  const when = new Date(transfer.receivedAt);
  const day = when.toDateString() === new Date().toDateString() ? 'today' : when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const at = `${day} at ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  const section = (title: string, list: typeof rows) =>
    list.length > 0 && (
      <section key={title} className="mt-5">
        <h3 className="px-1 mb-1.5 text-[13px] font-semibold text-gray-500">{title}</h3>
        <ul className="rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden" role="radiogroup" aria-label={title}>
          {list.map(({ m, theirs, total, reason }) => {
            const on = picked === m.playerId;
            const sub = reason ?? (theirs.length === 0 ? 'Owes nothing' : theirs.length === 1 ? `Owes for ${owedLabel(theirs[0])}` : `Owes for ${theirs.length} games`);
            return (
              <li key={m.playerId}>
                <button
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(m.playerId)}
                  className={`w-full flex items-center gap-3 min-h-16 px-3.5 py-2.5 text-left transition-colors ${on ? 'bg-volt-300/35' : 'hover:bg-chalk'}`}
                >
                  <MemberAvatar name={m.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-ink truncate">
                      {m.name}
                      {m.nickname ? <span className="font-semibold text-gray-500"> “{m.nickname}”</span> : null}
                    </span>
                    <span className={`block text-[13px] truncate ${reason ? 'font-semibold text-pitch-600' : 'text-gray-500'}`}>{sub}</span>
                  </span>
                  {total > 0 && <span className="shrink-0 font-display text-sm font-extrabold tabular-nums text-amber-700">{formatCurrency(total)}</span>}
                  <span
                    className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-colors ${on ? 'bg-ink text-volt-300' : 'border-2 border-gray-200'}`}
                    aria-hidden
                  >
                    {on && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
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
        <div className="space-y-3">
          {choice && <GiveReceipt amount={amount} member={choice} owed={owed} />}
          <button
            disabled={!choice || busy}
            onClick={() => choice && onGive(choice, describeGive(amount, choice, owed).toast)}
            className={`${btnPrimary} w-full disabled:opacity-40`}
          >
            {choice ? `Give ${formatCurrency(amount)} to ${firstName(choice)}` : 'Choose who sent it'}
          </button>
        </div>
      }
    >
      <SheetTitle id={titleId} title="Who sent this?" onClose={onClose} />
      <p className="mt-2 font-display text-[34px] leading-none font-extrabold text-ink tabular-nums">{formatCurrency(amount)}</p>
      <p className="mt-2 text-[13px] text-gray-600 leading-snug">
        {sender ? (
          <>
            From <span className="font-bold text-ink">{sender}</span>, {at}
          </>
        ) : (
          <>
            {transfer.narration ? `“${transfer.narration}”` : 'The bank didn’t say who sent it'}, {at}
          </>
        )}
      </p>
      <div className="relative mt-4">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the squad"
          aria-label="Search the squad"
          className="w-full h-11 pl-10 pr-3.5 bg-chalk rounded-xl text-[15px] placeholder:text-gray-500 focus:outline-none focus:bg-white focus:ring-4 focus:ring-volt-300/70"
        />
      </div>
      {section('Most likely', likely)}
      {section('Owe money', owing)}
      {section(likely.length || owing.length ? 'Everyone else' : 'The squad', rest)}
      {rows.length === 0 && <p className="mt-8 text-sm text-gray-600 text-center">No one in the squad is called “{query.trim()}”.</p>}
    </Sheet>
  );
}
