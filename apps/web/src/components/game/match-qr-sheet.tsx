'use client';

import { useEffect, useId, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary, btnSecondary } from '@/components/buttons';
import { BallSpinner } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { getGroupBilling } from '@/lib/api';

/**
 * This game's QR code, to show at the pitch: it opens the group link for this game. Players in
 * the group go straight to the game; anyone new signs up, joins the group, and lands on it.
 */
export function MatchQrSheet({
  sessionId,
  groupId,
  groupName,
  takesReplies,
  onClose,
}: {
  sessionId: string;
  groupId: string;
  groupName: string;
  /** Players say "I'm in" for games (else everyone in the group is on every game). */
  takesReplies: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGroupBilling(groupId).then(
      (b) => setUrl(`${b.link}?game=${sessionId}`),
      () => setError('The QR code didn’t load. Try again.'),
    );
  }, [groupId, sessionId]);

  const text = `Playing with ${groupName}? Open the game here:`;
  async function share() {
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${groupName} game`, text, url });
      } catch {
        // They closed the share menu: nothing to do.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  }
  const copy = () =>
    url &&
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Link copied'),
      () => toast.error('Could not copy. Press and hold the link to copy it instead.'),
    );

  const lines = [
    `Players in ${groupName} go straight to this game.`,
    `Anyone new signs up, joins ${groupName}, and lands on this game.`,
    takesReplies ? 'On the game they tap “I’m in” and see what to pay.' : 'New players are put on this game and see what to pay.',
  ];

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        url ? (
          <div className="flex gap-2">
            <button onClick={copy} className={`${btnSecondary} px-5`}>
              Copy link
            </button>
            <button onClick={share} className={`${btnPrimary} flex-1`}>
              Share link
            </button>
          </div>
        ) : undefined
      }
    >
      <SheetTitle id={titleId} title="Game QR code" sub="Show it at the pitch, or share the link." onClose={onClose} />
      {error ? (
        <p className="mt-6 rounded-2xl bg-chalk px-4 py-3 text-[14px] text-gray-700" role="alert">
          {error}
        </p>
      ) : !url ? (
        <div className="mt-6 flex justify-center py-16" aria-busy aria-label="Making the QR code">
          <BallSpinner className="w-6 h-6" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex justify-center animate-pop-in">
            <div className="rounded-3xl bg-white border-2 border-ink shadow-sticker p-4">
              <QRCodeCanvas value={url} size={208} level="M" role="img" aria-label={`QR code for this ${groupName} game`} />
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-[14px] leading-snug text-gray-700">
            {lines.map((l) => (
              <li key={l} className="flex gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-volt-500" aria-hidden />
                {l}
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
