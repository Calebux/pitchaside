'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary } from '@/components/buttons';
import { kitFor } from '@/components/illustrations';
import { useToast } from '@/components/toast';
import { formatCurrency, updatePlayer } from '@/lib/api';
import type { IPlayer } from '@pitchaside/shared';

export type MemberDue = { label: string; state: 'paid' | 'owes' | 'waived' | 'out'; amount: number } | null;

/**
 * One member, opened from the group's list: when they joined, where they stand for the next game,
 * a quick fix for their name or nickname, and (behind a confirm) removing them from the group.
 */
export function MemberSheet({
  player,
  joinedAt,
  credit,
  paymentCode,
  due,
  onSaved,
  onRemove,
  onClose,
}: {
  player: IPlayer;
  joinedAt: string;
  credit: number;
  /** Their code for transfer descriptions; null until they've opened their payment details. */
  paymentCode?: string | null;
  due: MemberDue;
  onSaved: (p: Pick<IPlayer, 'id' | 'firstName' | 'lastName' | 'nickname'>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const [form, setForm] = useState({ firstName: player.firstName, lastName: player.lastName, nickname: player.nickname ?? '' });
  const [saving, setSaving] = useState(false);
  const name = `${player.firstName} ${player.lastName}`;
  const kit = kitFor(name);
  const changed =
    form.firstName.trim() !== player.firstName || form.lastName.trim() !== player.lastName || form.nickname.trim() !== (player.nickname ?? '');

  async function save() {
    setSaving(true);
    try {
      const data = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), nickname: form.nickname.trim() };
      await updatePlayer(player.id, data);
      onSaved({ id: player.id, ...data, nickname: data.nickname || null });
      toast.success('Name saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The name didn’t save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const copyCode = (code: string) =>
    navigator.clipboard.writeText(code).then(
      () => toast.success('Payment code copied'),
      () => toast.error('Could not copy. Press and hold the code to copy it instead.'),
    );

  const input =
    'w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';
  const facts = [
    { k: 'Joined', v: new Date(joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
    due && {
      k: due.label,
      v: due.state === 'paid' ? 'Paid' : due.state === 'waived' ? 'Free' : due.state === 'owes' ? `${formatCurrency(due.amount)} to pay` : 'Not in',
      tone: due.state === 'owes' ? 'text-amber-700' : due.state === 'paid' ? 'text-pitch-600' : 'text-gray-600',
    },
    credit > 0 && {
      k: 'Paid ahead',
      v: formatCurrency(credit),
      note: 'Not used yet. Goes towards their next game.',
    },
  ].filter(Boolean) as { k: string; v: string; tone?: string; note?: string }[];

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left">
      <div className="flex items-start gap-3">
        <span className={`w-12 h-12 shrink-0 rounded-full ${kit.bg} ${kit.fg} flex items-center justify-center text-base font-extrabold font-display`} aria-hidden>
          {player.firstName.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <SheetTitle id={titleId} title={name} sub={player.nickname ? `“${player.nickname}” on the team sheet` : undefined} onClose={onClose} />
        </div>
      </div>

      <dl className="mt-4 rounded-2xl bg-chalk divide-y divide-gray-200/70">
        {facts.map((f) => (
          <div key={f.k} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <dt className="text-[13px] text-gray-600">
              {f.k}
              {f.note && <span className="block text-[11px] text-gray-500">{f.note}</span>}
            </dt>
            <dd className={`text-[13px] font-bold tabular-nums ${f.tone ?? 'text-ink'}`}>{f.v}</dd>
          </div>
        ))}
        {paymentCode && (
          <div className="flex items-center justify-between gap-3 pl-3.5 pr-1.5 py-1.5">
            <dt className="min-w-0 py-1 text-[13px] text-gray-600">
              Payment code
              <span className="block text-[11px] leading-snug text-gray-500">If {player.firstName} adds it to a transfer, it matches automatically</span>
            </dt>
            <dd>
              <button
                onClick={() => copyCode(paymentCode)}
                aria-label={`Copy payment code ${paymentCode}`}
                className="press shrink-0 flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-xl hover:bg-white transition-colors"
              >
                <span className="font-display text-[15px] font-extrabold tracking-wide text-ink">{paymentCode}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-9.376a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25" />
                </svg>
              </button>
            </dd>
          </div>
        )}
      </dl>


      <h3 className="mt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-600">Name on the app</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">First name</span>
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={input} autoComplete="off" />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-gray-700 mb-1">Last name</span>
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={input} autoComplete="off" />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="block text-xs font-bold text-gray-700 mb-1">Nickname <span className="font-semibold text-gray-500">(optional, shown on team sheets)</span></span>
        <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="e.g. Pele" className={input} autoComplete="off" />
      </label>
      <button
        onClick={save}
        disabled={!changed || saving || !form.firstName.trim() || !form.lastName.trim()}
        className={`${btnPrimary} mt-3 w-full disabled:opacity-40`}
      >
        {saving ? 'Saving…' : 'Save name'}
      </button>

      <div className="mt-4 -mx-2">
        <Link href={`/players/${player.id}`} className="press flex items-center justify-between min-h-12 px-2 rounded-xl text-[15px] font-semibold text-ink hover:bg-chalk">
          Full profile and history
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
        <button onClick={onRemove} className="press w-full flex items-center min-h-12 px-2 rounded-xl text-[15px] font-semibold text-kit-600 hover:bg-kit-500/10">
          Remove from group
        </button>
      </div>
    </Sheet>
  );
}
