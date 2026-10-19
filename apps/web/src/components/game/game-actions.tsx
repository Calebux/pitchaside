'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { btnPrimary, btnSecondary } from '@/components/buttons';
import { stagger } from '@/components/motion';

type MenuItem = { key: string; title: string; detail: string; danger?: boolean; onPick: () => void };

/**
 * A game's actions: the one that matters now (End game once it's been played), Remind when
 * anyone owes, and everything else under More, named in words, with a confirm before anything
 * that can't be taken back.
 */
export function GameActions({
  canEnd,
  ended,
  cancelled,
  toPay,
  reminding,
  onEnd,
  onRemind,
  onReopen,
  onDownload,
  onCancel,
  onDelete,
}: {
  /** The game day has come (or passed) and it isn't ended yet. */
  canEnd: boolean;
  ended: boolean;
  cancelled: boolean;
  toPay: number;
  reminding: boolean;
  onEnd: () => void;
  onRemind: () => void;
  onReopen: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);

  const showEnd = canEnd && !ended && !cancelled;
  const showRemind = toPay > 0 && !cancelled;
  const alone = !showEnd && !showRemind;

  const items: MenuItem[] = [
    ...(!ended && !cancelled && !canEnd
      ? [{ key: 'end', title: 'End game now', detail: 'Before the game day: say who came and send the vote link.', onPick: onEnd }]
      : []),
    ...(ended || cancelled
      ? [{ key: 'reopen', title: cancelled ? 'Bring the game back' : 'Reopen game', detail: cancelled ? 'It’s on again; players pay as before.' : 'Back to not ended. Who came stays as it is.', onPick: onReopen }]
      : []),
    { key: 'download', title: 'Download payments', detail: 'A spreadsheet of who paid, how and when.', onPick: onDownload },
    ...(!cancelled
      ? [{ key: 'cancel', title: 'Cancel game', detail: 'Players who paid by transfer keep the money for their next game.', danger: true, onPick: () => setConfirm('cancel') }]
      : []),
    { key: 'delete', title: 'Delete game', detail: 'Removes the game and its payments for good.', danger: true, onPick: () => setConfirm('delete') },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        {showEnd && (
          <button onClick={onEnd} className={`${btnPrimary} flex-1`}>
            End game
          </button>
        )}
        {showRemind && (
          <button onClick={onRemind} disabled={reminding} className={`${btnSecondary} ${showEnd ? '' : 'flex-1'} disabled:opacity-50`}>
            {reminding ? 'Sending…' : `Remind ${toPay}`}
          </button>
        )}
        <button onClick={() => setOpen(true)} aria-label="More for this game" className={`${btnSecondary} ${alone ? 'flex-1' : 'w-12 px-0'}`}>
          {alone ? (
            'More'
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <Sheet titleId={titleId} onClose={() => setOpen(false)} align="left">
          <SheetTitle id={titleId} title="This game" onClose={() => setOpen(false)} />
          <ul className="mt-3 -mx-2">
            {items.map((it, i) => (
              <li key={it.key} className="animate-rise" style={stagger(i, 45, 30)}>
                <button
                  onClick={() => {
                    setOpen(false);
                    it.onPick();
                  }}
                  className="press w-full text-left px-2 py-3 rounded-2xl hover:bg-chalk"
                >
                  <span className={`block text-[15px] font-bold ${it.danger ? 'text-kit-600' : 'text-ink'}`}>{it.title}</span>
                  <span className="block text-[13px] leading-snug text-gray-600">{it.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this game?"
        message="Players are told it’s off. Anyone who paid by transfer keeps the money for their next game. You can bring it back later."
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
        message="The game and its payments are removed for good. Anyone who paid by transfer keeps the money for their next game."
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
