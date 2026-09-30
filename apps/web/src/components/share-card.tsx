'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BallSpinner } from '@/components/skeleton';

/**
 * "Share match card": opens a sheet with the match-day card image, then shares
 * the PNG through the phone's share sheet, sends the link to WhatsApp (its
 * preview is the card), or saves the image.
 *
 * The image loads while the sheet is open so the Share tap can call
 * navigator.share straight away — iOS rejects a share that waits on a fetch.
 */
export function ShareCardButton({
  token,
  caption,
  className,
  children = 'Share match card',
}: {
  /** The game's vote token. */
  token: string;
  /** Message sent with the card, e.g. "Tuesday Night 5s — match day". */
  caption: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <ShareSheet token={token} caption={caption} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareSheet({ token, caption, onClose }: { token: string; caption: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pageUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/share/${token}`;
  const canShareFiles =
    !!file && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });

  useEffect(() => {
    let objectUrl: string | null = null;
    fetch(`/share/${token}/image`)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('card'))))
      .then((blob) => {
        setFile(new File([blob], 'pitchaside-match-day.png', { type: 'image/png' }));
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  async function shareImage() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: `${caption} ${pageUrl}` });
    } catch (err) {
      // Cancelled is fine; anything else falls back to the link.
      if ((err as Error).name !== 'AbortError') whatsapp();
    }
  }

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${caption} ${pageUrl}`)}`, '_blank', 'noopener');
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share match card"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-4 animate-slide-up sm:animate-fade-in-up max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-ink">Share the match day</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-500 hover:text-ink" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="aspect-[4/5] w-full max-h-[52dvh] mx-auto rounded-2xl overflow-hidden bg-pitch-950 flex items-center justify-center">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a blob URL, not an optimisable asset
            <img src={url} alt={`Match card: ${caption}`} className="w-full h-full object-contain" />
          ) : failed ? (
            <p className="text-sm text-white/60 px-6 text-center">Couldn’t make the card. You can still share the link.</p>
          ) : (
            <BallSpinner />
          )}
        </div>

        <div className="mt-4 space-y-2">
          {canShareFiles && (
            <button
              onClick={shareImage}
              className="w-full py-3.5 text-sm font-bold text-volt-300 bg-ink rounded-xl hover:bg-pitch-900 transition-colors"
            >
              Share image
            </button>
          )}
          <button
            onClick={whatsapp}
            className="w-full py-3.5 text-sm font-bold text-white bg-[#25D366] rounded-xl hover:brightness-95 transition"
          >
            Send to WhatsApp
          </button>
          {url && (
            <a
              href={url}
              download="pitchaside-match-day.png"
              className="block w-full py-3 text-center text-sm font-bold text-ink bg-chalk rounded-xl hover:bg-gray-200 transition-colors"
            >
              Save image
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
