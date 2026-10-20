'use client';

import { useEffect, useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary } from '@/components/buttons';
import { kitFor } from '@/components/illustrations';
import { formatCurrency, getGiveExtraPreview, type ExtraMoney, type ExtraSource, type GiveExtraPreview, type OwedItem } from '@/lib/api';
import { owedLabel, type MatchMember } from '@/lib/give-outcome';

type Choice = 'someone' | 'unknown' | 'keep' | 'back' | 'release';

/** "Sat 17 Oct", or "October 2026 dues". */
const dueLabel = (d: { date: string; label: string | null; kind: string }) =>
  owedLabel({ date: d.date, label: d.label, kind: d.kind } as OwedItem);

/**
 * A member sent more than they owed: what was the extra for? Paying for someone else (it pays
 * what they owe now, shown before confirming), someone not in the group yet or no one knows who
 * (it waits, apart from the sender's money), keeping it for the sender's next game, or sending
 * it back. Nothing happens with the money until the organiser picks one.
 *
 * With `source` 'waiting' it sorts money already waiting for a player: give it to the player
 * once they're in the group, or put it back with the sender's extra.
 */
export function ExtraSheet({
  groupId,
  source = 'extra',
  item,
  members,
  owed,
  busy,
  onGive,
  onKeep,
  onSendBack,
  onHold,
  onRelease,
  onClose,
}: {
  groupId: string;
  source?: ExtraSource;
  item: ExtraMoney;
  members: MatchMember[];
  owed: OwedItem[];
  busy: boolean;
  onGive: (to: MatchMember, toast: string) => void;
  onKeep: () => void;
  onSendBack: () => void;
  onHold: (note: string) => void;
  onRelease: () => void;
  onClose: () => void;
}) {
  const waiting = source === 'waiting';
  const amount = waiting ? item.waiting : item.extra;
  const titleId = useId();
  const first = item.name.split(' ')[0];
  const [choice, setChoice] = useState<Choice | null>(null);
  const [query, setQuery] = useState('');
  const [to, setTo] = useState<MatchMember | null>(null);
  const [preview, setPreview] = useState<GiveExtraPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setPreview(null);
    setPreviewFailed(false);
    if (!to) return;
    getGiveExtraPreview(groupId, item.playerId, to.playerId, source).then(setPreview, () => setPreviewFailed(true));
  }, [groupId, item.playerId, to, source]);

  // Who owes, most first: the likeliest people the extra was for.
  const owes = (playerId: string) => owed.filter((o) => o.playerId === playerId).reduce((n, o) => n + o.amount, 0);
  const q = query.trim().toLowerCase();
  const others = members
    .filter((m) => m.playerId !== item.playerId)
    .filter((m) => !q || `${m.name} ${m.nickname ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => owes(b.playerId) - owes(a.playerId) || a.name.localeCompare(b.name));
  const toFirst = to?.name.split(' ')[0];
  // Name the transfer only when it alone explains the extra.
  const sent = item.lastTransfer && item.lastTransfer.amount + 0.001 >= amount
    ? `${formatCurrency(item.lastTransfer.amount)} on ${new Date(item.lastTransfer.receivedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}`
    : null;

  const options: { key: Choice; title: string; hint: string }[] = waiting
    ? [
        { key: 'someone', title: 'It was for a player in the group', hint: 'It pays what they owe now' },
        { key: 'release', title: `Put it back with ${first}’s extra`, hint: 'Then keep it for them or send it back' },
      ]
    : [
        { key: 'someone', title: 'Paying for someone else', hint: 'Like a friend’s game fee' },
        { key: 'unknown', title: 'For someone not in the group yet', hint: 'Or you don’t know who. It waits until you find out' },
        { key: 'keep', title: `Keep it for ${first}’s next game`, hint: 'It pays their next game once it’s the next one' },
        { key: 'back', title: `Send it back to ${first}`, hint: 'Refund it from the group account' },
      ];

  const outcome = (() => {
    if (!preview || !to) return null;
    const parts = [
      preview.pays.length ? `Pays ${toFirst}’s ${preview.pays.map(dueLabel).join(' and ')}` : null,
      preview.towards ? `${formatCurrency(preview.towards.paidSoFar)} towards ${toFirst}’s ${dueLabel(preview.towards)}` : null,
      preview.left > 0.5 ? `${formatCurrency(preview.left)} ${waiting ? 'keeps waiting' : 'stays to sort'}` : null,
    ].filter(Boolean);
    return parts.join('. ');
  })();

  const footer =
    choice === 'someone' ? (
      <div className="space-y-2">
        {to && (
          <p className="text-[13px] leading-snug font-semibold text-ink" aria-live="polite">
            {previewFailed ? 'We couldn’t check what this pays. Try again.' : !preview ? 'Checking what it pays…' : preview.move <= 0.001 ? `${toFirst} doesn’t owe anything that can be paid now.` : `${outcome}.`}
          </p>
        )}
        <button
          disabled={!to || !preview || preview.move <= 0.001 || busy}
          onClick={() => to && preview && onGive(to, `${formatCurrency(preview.move)} ${waiting ? 'from ' + first : 'of ' + first + '’s extra'} paid for ${to.name}. ${outcome}.`)}
          className={`${btnPrimary} w-full disabled:opacity-40`}
        >
          {busy ? 'Saving…' : to ? `Pay for ${toFirst}` : 'Pick who it was for'}
        </button>
      </div>
    ) : choice === 'unknown' ? (
      <button disabled={busy} onClick={() => onHold(note.trim())} className={`${btnPrimary} w-full`}>
        {busy ? 'Saving…' : `Hold ${formatCurrency(amount)} until you know who`}
      </button>
    ) : choice === 'release' ? (
      <button disabled={busy} onClick={onRelease} className={`${btnPrimary} w-full`}>
        {busy ? 'Saving…' : `Put ${formatCurrency(amount)} back with ${first}’s extra`}
      </button>
    ) : choice === 'keep' ? (
      <button disabled={busy} onClick={onKeep} className={`${btnPrimary} w-full`}>
        {busy ? 'Saving…' : `Keep ${formatCurrency(amount)} for ${first}`}
      </button>
    ) : choice === 'back' ? (
      <button onClick={onSendBack} className={`${btnPrimary} w-full`}>
        Send {formatCurrency(amount)} back to {first}
      </button>
    ) : (
      <button disabled className={`${btnPrimary} w-full opacity-40`}>
        Pick what it was for
      </button>
    );

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left" footer={footer}>
      <SheetTitle
        id={titleId}
        title={waiting ? `${formatCurrency(amount)} waiting for a player` : `What was the extra ${formatCurrency(amount)} for?`}
        sub={
          waiting
            ? `Sent by ${item.name}${item.waitingNote ? `, for “${item.waitingNote}”` : ''}. It pays nothing until you say who it’s for.`
            : `${item.name} sent more than they owed${sent ? ` (${sent})` : ', over earlier transfers'}. Nothing happens with it until you choose.`
        }
        onClose={onClose}
      />

      <div role="radiogroup" aria-label="What was it for?" className="mt-4 space-y-2">
        {options.map((o) => {
          const on = choice === o.key;
          return (
            <button
              key={o.key}
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(o.key)}
              className={`press w-full flex items-center gap-3 min-h-16 px-4 py-2.5 rounded-2xl border text-left transition-colors ${
                on ? 'bg-ink border-ink text-white' : 'bg-white border-gray-200 text-ink hover:border-ink'
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] font-bold ${on ? 'text-volt-300' : ''}`}>{o.title}</span>
                <span className={`block text-[13px] leading-snug ${on ? 'text-white/75' : 'text-gray-500'}`}>{o.hint}</span>
              </span>
              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${on ? 'bg-volt-300 text-ink' : 'border-2 border-gray-200'}`} aria-hidden>
                {on && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {choice === 'someone' && (
        <div className="mt-4">
          <h3 className="px-1 mb-2 text-[13px] font-semibold text-gray-500">Who was it for?</h3>
          {members.length > 8 && (
            <div className="sticky top-0 z-10 -mx-6 px-6 pt-1 pb-2 bg-white">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a player"
                aria-label="Find a player"
                className="w-full h-11 px-3.5 bg-chalk rounded-xl text-[15px] placeholder:text-gray-500 focus:outline-none focus:bg-white focus:ring-4 focus:ring-volt-300/70"
              />
            </div>
          )}
          {others.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{q ? `No one called “${query.trim()}”.` : 'No one else in the group yet.'}</p>
          ) : (
            <ul role="radiogroup" aria-label="Who was it for?" className="rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {others.map((m) => {
                const on = to?.playerId === m.playerId;
                const kit = kitFor(m.name);
                const due = owes(m.playerId);
                return (
                  <li key={m.playerId}>
                    <button
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTo(m)}
                      className={`w-full flex items-center gap-3 min-h-16 px-3.5 py-2.5 text-left transition-colors ${on ? 'bg-volt-300/35' : 'hover:bg-chalk'}`}
                    >
                      <span className={`w-10 h-10 shrink-0 rounded-full ${kit.bg} ${kit.fg} flex items-center justify-center text-sm font-extrabold font-display`} aria-hidden>
                        {m.name.charAt(0)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-ink truncate">{m.name}</span>
                        <span className={`block text-[13px] ${due ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>{due ? `Owes ${formatCurrency(due)}` : 'Owes nothing'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {choice === 'unknown' && (
        <div className="mt-4">
          <label className="block">
            <span className="block px-1 mb-1.5 text-[13px] font-semibold text-gray-500">Who might it be for? (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 80))}
              maxLength={80}
              placeholder="e.g. Kunle’s friend, new player Tobi"
              className="w-full h-11 px-3.5 bg-chalk rounded-xl text-[15px] placeholder:text-gray-500 focus:outline-none focus:bg-white focus:ring-4 focus:ring-volt-300/70"
            />
          </label>
          <p className="mt-3 rounded-2xl bg-chalk px-4 py-3 text-[13px] leading-snug text-gray-700">
            It stays in the group account under “Waiting for a player”, not as {first}’s money, and pays no one’s game. When you know who it was
            for, add them to the group and give it to them there.
          </p>
        </div>
      )}
      {choice === 'release' && (
        <p className="mt-4 rounded-2xl bg-chalk px-4 py-3 text-[13px] leading-snug text-gray-700">
          It goes back to {first}’s extra to sort, where you can keep it for their next game or send it back to them.
        </p>
      )}
      {choice === 'keep' && (
        <p className="mt-4 rounded-2xl bg-chalk px-4 py-3 text-[13px] leading-snug text-gray-700">
          It shows as paid ahead for {first}. It pays their next game when that game is the next one, never games further ahead. You can still send it back
          later from Send money.
        </p>
      )}
      {choice === 'back' && (
        <p className="mt-4 rounded-2xl bg-chalk px-4 py-3 text-[13px] leading-snug text-gray-700">
          Opens Send money with a refund to {first} ready. Send it to their own account.
        </p>
      )}
    </Sheet>
  );
}
