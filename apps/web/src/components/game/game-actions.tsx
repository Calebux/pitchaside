'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { stagger } from '@/components/motion';
import type { GamePhase } from '@/lib/game-player';

type MenuItem = { key: string; title: string; detail: string; danger?: boolean; onPick: () => void };

/**
 * Everything about the game itself that isn't today's job, behind one labelled button at the top
 * of the page: end it early, reopen it, download its payments, cancel or delete it (each asks
 * first). Day-to-day actions live where they apply: Remind on the money, End game below the card.
 */
export function GameMenu({
  phase,
  onEdit,
  onEnd,
  onReopen,
  onDownload,
  onCancel,
  onDelete,
}: {
  phase: GamePhase;
  /** Move the game (day and kick-off); left out once it can't move (scores in, ended). */
  onEdit?: () => void;
  onEnd: () => void;
  onReopen: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const live = phase === 'before' || phase === 'today';

  const items: MenuItem[] = [
    ...(onEdit && live ? [{ key: 'edit', title: 'Change day or time', detail: 'Players in the game are notified, and reminders go for the new time.', onPick: onEdit }] : []),
    ...(live ? [{ key: 'end', title: 'End game now', detail: 'Say who came and send the vote link before the usual time.', onPick: onEnd }] : []),
    ...(phase === 'ended' || phase === 'cancelled'
      ? [
          {
            key: 'reopen',
            title: phase === 'cancelled' ? 'Bring the game back' : 'Reopen game',
            detail: phase === 'cancelled' ? 'It’s on again; players pay as before.' : 'Back to not ended. Who came stays as it is.',
            onPick: onReopen,
          },
        ]
      : []),
    { key: 'download', title: 'Download payments', detail: 'A spreadsheet of who paid, how and when.', onPick: onDownload },
    ...(phase !== 'cancelled' && phase !== 'ended'
      ? [{ key: 'cancel', title: 'Cancel game', detail: 'Players are told it’s off. Money paid by transfer goes to Extra money to sort on Money.', danger: true, onPick: () => setConfirm('cancel') }]
      : []),
    { key: 'delete', title: 'Delete game', detail: 'Removes the game and its payments for good.', danger: true, onPick: () => setConfirm('delete') },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="press inline-flex items-center gap-1 h-9 pl-3.5 pr-2.5 rounded-full bg-white border border-gray-200 text-[13px] font-bold text-ink shadow-card hover:border-ink"
      >
        Options
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <Sheet titleId={titleId} onClose={() => setOpen(false)} align="left">
          <SheetTitle id={titleId} title="Game options" onClose={() => setOpen(false)} />
          <ul className="mt-3 -mx-2">
            {items.map((it, i) => (
              <li key={it.key} className="animate-rise" style={stagger(i, 45, 30)}>
                <button
                  onClick={() => {
                    setOpen(false);
                    it.onPick();
                  }}
                  className="press w-full flex items-center gap-3 text-left px-2 py-3 rounded-2xl hover:bg-chalk"
                >
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[15px] font-bold ${it.danger ? 'text-kit-600' : 'text-ink'}`}>{it.title}</span>
                    <span className="block text-[13px] leading-snug text-gray-600">{it.detail}</span>
                  </span>
                  <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this game?"
        message="Players are told it’s off. What anyone paid by transfer goes to Extra money to sort on Money. If you bring the game back, it pays it again."
        confirmLabel="Cancel game"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={() => {
          setConfirm(null);
          onCancel();
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this game?"
        message="The game and its payments are removed for good. What anyone paid by transfer goes to Extra money to sort on Money."
        confirmLabel="Delete game"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={() => {
          setConfirm(null);
          onDelete();
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
