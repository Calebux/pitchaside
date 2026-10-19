'use client';

import { useEffect, useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnDanger, btnPrimary } from '@/components/buttons';
import { formatCurrency, getNotPlayerPreview, type BankTransfer, type MoneyInCategory, type NotPlayerPreview } from '@/lib/api';
import { MONEY_IN } from '@/lib/money-categories';

/** "Sat 17 Oct", or "October 2026 dues". */
function gameLabel(r: NotPlayerPreview['reopen'][number]) {
  if (r.kind === 'dues' && r.label) return `${r.label} dues`;
  const [y, m, d] = String(r.date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/**
 * Money in that isn't a player paying: the organiser's own top-up, a sponsor, a refund. It stays in
 * the account but is never anyone's dues. If it had been put on a player, the sheet says exactly
 * what that undoes before anything changes (the server works it out, so the words match).
 */
export function NotPlayerSheet({
  transfer,
  playerName,
  busy,
  onConfirm,
  onSetAside,
  onClose,
}: {
  transfer: BankTransfer;
  /** Who it's on now, if it was put on a player. */
  playerName?: string | null;
  busy: boolean;
  onConfirm: (category: MoneyInCategory, note: string) => void;
  /** For a duplicate or a mistake: leave it out of Money in altogether. */
  onSetAside?: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const editing = transfer.status === 'other';
  const [category, setCategory] = useState<MoneyInCategory | null>(transfer.category ?? null);
  const [note, setNote] = useState(transfer.note ?? '');
  const placed = transfer.status === 'matched' || transfer.status === 'assigned';
  const [preview, setPreview] = useState<NotPlayerPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!placed) return;
    getNotPlayerPreview(transfer.id).then(setPreview, () => setPreviewFailed(true));
  }, [placed, transfer.id]);

  const first = playerName?.split(' ')[0] ?? 'the player';
  const undoes = !!preview && (preview.fromKept > 0 || preview.reopen.length > 0);
  const waiting = placed && !preview && !previewFailed;
  const amount = formatCurrency(Number(transfer.amount));

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        <button
          disabled={!category || busy || waiting || previewFailed}
          onClick={() => category && onConfirm(category, note)}
          className={`${undoes ? btnDanger : btnPrimary} w-full disabled:opacity-40`}
        >
          {busy ? 'Saving…' : editing ? 'Save' : !category ? 'Pick what it was' : undoes ? `Take it off ${first}` : `Mark as ${MONEY_IN[category].label.toLowerCase()}`}
        </button>
      }
    >
      <SheetTitle
        id={titleId}
        title={editing ? 'What was this money?' : 'Not a player payment'}
        sub={`${amount} in. It stays in the group account and counts in the balance, but not as anyone’s payment.`}
        onClose={onClose}
      />

      <h3 className="mt-5 px-1 mb-2 text-[13px] font-semibold text-gray-500">What was it?</h3>
      <div role="radiogroup" aria-label="What was it?" className="grid grid-cols-2 gap-2">
        {(Object.keys(MONEY_IN) as MoneyInCategory[]).map((k) => {
          const on = category === k;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={on}
              onClick={() => setCategory(k)}
              className={`press min-h-16 rounded-2xl border px-3 py-2 text-left transition-colors ${
                on ? 'bg-ink border-ink text-white' : 'bg-white border-gray-200 text-ink hover:border-ink'
              }`}
            >
              <span className={`block text-[15px] font-bold ${on ? 'text-volt-300' : ''}`}>{MONEY_IN[k].label}</span>
              <span className={`block text-[12px] leading-snug ${on ? 'text-white/75' : 'text-gray-500'}`}>{MONEY_IN[k].hint}</span>
            </button>
          );
        })}
      </div>

      <label className="block mt-4">
        <span className="block px-1 mb-1.5 text-[13px] font-semibold text-gray-500">Note (optional)</span>
        <input
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. My deposit for the new bibs"
          className="w-full min-h-12 px-3.5 border border-gray-200 rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600"
        />
      </label>

      {placed && (
        <div className="mt-4 rounded-2xl bg-chalk px-4 py-3 text-[13px] leading-snug text-gray-700" aria-live="polite">
          {previewFailed ? (
            <p role="alert">We couldn’t check what this changes for {first}. Close and try again.</p>
          ) : !preview ? (
            <p>Checking what this changes for {first}…</p>
          ) : !undoes ? (
            <p>
              It was on <span className="font-bold text-ink">{playerName}</span>, but none of it was used. Nothing changes for them.
            </p>
          ) : (
            <>
              <p className="font-bold text-ink">This was put on {playerName}. Taking it off:</p>
              <ul className="mt-1.5 space-y-1 list-disc pl-4">
                {preview.fromKept > 0 && <li>{formatCurrency(preview.fromKept)} comes off the money kept for {first}</li>}
                {preview.reopen.map((r) => (
                  <li key={r.paymentId}>
                    {gameLabel(r)} ({formatCurrency(r.amount)}) goes back to <span className="font-bold text-kit-600">owing</span>
                  </li>
                ))}
                {preview.backToKept > 0 && <li>{formatCurrency(preview.backToKept)} they’d already paid stays kept for {first}</li>}
              </ul>
            </>
          )}
        </div>
      )}

      {onSetAside && (
        <p className="mt-4 px-1 text-[13px] text-gray-600">
          A duplicate or a mistake?{' '}
          <button onClick={onSetAside} disabled={busy} className="min-h-11 font-bold text-ink underline underline-offset-2 disabled:opacity-40">
            Set it aside instead
          </button>
        </p>
      )}
    </Sheet>
  );
}
