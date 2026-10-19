'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { stagger } from '@/components/motion';
import { formatCurrency, type OwedItem } from '@/lib/api';
import { owedLabel } from '@/lib/give-outcome';

/**
 * Money that came by transfer pays a player's oldest unpaid game first. When they meant another
 * one, the organiser picks it here: that game becomes paid, this one goes back to unpaid. Games
 * that cost more than the payment can't take it, and say why. Asks before moving.
 */
export function MovePaymentSheet({
  name,
  amount,
  fromLabel,
  games,
  onMove,
  onClose,
}: {
  /** The player's first name. */
  name: string;
  /** What the payment is. */
  amount: number;
  /** The game it pays now: "Sat 24 Oct". */
  fromLabel: string;
  /** Their other unpaid games in this group. */
  games: OwedItem[];
  onMove: (to: OwedItem) => Promise<void>;
  onClose: () => void;
}) {
  const titleId = useId();
  const [picked, setPicked] = useState<OwedItem | null>(null);
  const [busy, setBusy] = useState(false);
  const extra = picked ? amount - picked.amount : 0;

  return (
    <>
      <Sheet titleId={titleId} onClose={onClose} align="left">
        <SheetTitle
          id={titleId}
          title={`Move ${name}’s ${formatCurrency(amount)}`}
          sub={`It paid ${fromLabel}. Pick the game it was for.`}
          onClose={onClose}
        />
        {games.length === 0 ? (
          <p className="mt-6 mb-2 text-center text-sm text-gray-600">{name} has no other unpaid game in this group.</p>
        ) : (
          <ul className="mt-4 -mx-2">
            {games.map((g, i) => {
              const tooMuch = g.amount > amount;
              return (
                <li key={g.paymentId} className="animate-rise" style={stagger(i, 40, 30)}>
                  <button
                    onClick={() => setPicked(g)}
                    disabled={tooMuch || busy}
                    className="press w-full flex items-center gap-3 text-left px-2 min-h-14 py-2.5 rounded-2xl hover:bg-chalk disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[15px] font-bold ${tooMuch ? 'text-gray-400' : 'text-ink'}`}>{owedLabel(g)}</span>
                      <span className="block text-[13px] leading-snug text-gray-600">
                        {tooMuch ? `Costs ${formatCurrency(g.amount)}, more than this payment` : `${formatCurrency(g.amount)} to pay`}
                      </span>
                    </span>
                    {!tooMuch && (
                      <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!picked}
        title={picked ? `Move it to ${owedLabel(picked)}?` : ''}
        message={
          picked
            ? `${owedLabel(picked)} becomes paid. ${fromLabel} goes back to ${formatCurrency(amount)} to pay.${
                extra > 0 ? ` The other ${formatCurrency(extra)} is kept for ${name}’s next game.` : ''
              }`
            : ''
        }
        confirmLabel="Move payment"
        cancelLabel="Keep it here"
        onConfirm={async () => {
          if (!picked) return;
          setBusy(true);
          try {
            await onMove(picked);
          } finally {
            setBusy(false);
            setPicked(null);
          }
        }}
        onCancel={() => setPicked(null)}
      />
    </>
  );
}
