'use client';

import { Avatar } from '@/components/ratings';
import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary } from '@/components/buttons';
import { nameFit, senderFrom } from '@/lib/name-match';
import { accountHint } from '@/components/group/how-paid-sheet';
import { formatCurrency, type BankTransfer, type OwedItem } from '@/lib/api';
import { describeGive, owedLabel, type MatchMember } from '@/lib/give-outcome';

const firstName = (m: MatchMember) => m.name.split(' ')[0];

/** A small difference either way (a typo, a bank charge), and within three days of the transfer. */
const CLAIM_SLACK = 25;
const CLAIM_DAYS = 3;

/**
 * Why a member might have sent this. The name the bank gave comes first: it's the strongest
 * clue. "I've paid" only makes someone likely when the amount and the day also fit; otherwise
 * it's mentioned under their name but doesn't put them at the top.
 */
function likeliness(t: BankTransfer, m: MatchMember) {
  const { fit, hits } = nameFit(m.name, `${senderFrom(t) ?? ''} ${t.narration ?? ''}`);
  const at = new Date(t.receivedAt).getTime();
  const claims = (t.claims ?? []).filter((c) => c.player.id === m.playerId);
  const fits = claims.some(
    (c) => Math.abs(Number(c.amount) - Number(t.amount)) <= CLAIM_SLACK && Math.abs(new Date(c.createdAt).getTime() - at) <= CLAIM_DAYS * 86_400_000,
  );
  const name = fit === 'exact' ? 'Name matches' : fit === 'similar' ? 'Name looks similar' : null;
  const both = fit === 'exact' ? 'Name matches' : 'Similar name';
  const reason = name && claims.length ? `${both}, said they’ve paid` : name ?? (fits ? 'Said they’ve paid this amount' : null);
  return {
    score: (fit === 'exact' ? 20 : fit === 'similar' ? 12 : 0) + (fits ? 8 : claims.length ? 2 : 0) + hits,
    reason,
    /** Said they've paid, but the amount or the day doesn't fit this transfer. */
    claimedOther: !reason && claims.length > 0,
  };
}

function MemberAvatar({ name, photoKey, className = 'w-10 h-10 text-sm' }: { name: string; photoKey?: string | null; className?: string }) {
  return (
    <span aria-hidden>
      <Avatar name={name} photoKey={photoKey} className={className} />
    </span>
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
  picked: initialPick,
  onClose,
  onGive,
}: {
  transfer: BankTransfer;
  members: MatchMember[];
  owed: OwedItem[];
  busy: boolean;
  /** Opened from "Give to Ada…": start with them picked, so the footer shows what it pays. */
  picked?: string;
  onClose: () => void;
  onGive: (m: MatchMember, toast: string) => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(initialPick ?? null);
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
  const sender = senderFrom(transfer)?.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const when = new Date(transfer.receivedAt);
  const day = when.toDateString() === new Date().toDateString() ? 'today' : when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const at = `${day} at ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  const section = (title: string, list: typeof rows) =>
    list.length > 0 && (
      <section key={title} className="mt-5">
        <h3 className="px-1 mb-1.5 text-[13px] font-semibold text-gray-500">{title}</h3>
        <ul className="rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden" role="radiogroup" aria-label={title}>
          {list.map(({ m, theirs, total, reason, claimedOther }) => {
            const on = picked === m.playerId;
            const sub = reason ?? (claimedOther ? 'Said they’ve paid, not this amount or day' : theirs.length === 0 ? 'Owes nothing' : theirs.length === 1 ? `Owes for ${owedLabel(theirs[0])}` : `Owes for ${theirs.length} games`);
            return (
              <li key={m.playerId}>
                <button
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(m.playerId)}
                  className={`w-full flex items-center gap-3 min-h-16 px-3.5 py-2.5 text-left transition-colors ${on ? 'bg-volt-300/35' : 'hover:bg-chalk'}`}
                >
                  <MemberAvatar name={m.name} photoKey={m.photoKey} />
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
        <div className="space-y-2">
          {choice && (
            <p className="text-[13px] leading-snug font-semibold text-ink" aria-live="polite">
              {describeGive(amount, choice, owed).brief}.
            </p>
          )}
          <button
            disabled={!choice || busy}
            onClick={() => choice && onGive(choice, describeGive(amount, choice, owed).toast)}
            className={`${btnPrimary} w-full disabled:opacity-40`}
          >
            {choice ? `Give ${formatCurrency(amount)} to ${firstName(choice)}` : 'Pick a player'}
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
            {accountHint(transfer)}
          </>
        ) : (
          <>
            {transfer.narration ? `“${transfer.narration}”` : 'The bank didn’t say who sent it'}, {at}
            {accountHint(transfer)}
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
