'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Confetti } from '@/components/confetti';
import { Celebration, Envelope } from '@/components/illustrations';
import { BallSpinner } from '@/components/skeleton';
import { resendVerification } from '@/lib/api';

type SendState = 'idle' | 'sending' | 'sent' | 'failed';

/** Resending the verification email, and saying how it went. */
function useResend() {
  const [state, setState] = useState<SendState>('idle');
  async function resend() {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch {
      setState('failed');
    }
  }
  return { state, resend };
}

function SendStatus({ state }: { state: SendState }) {
  return (
    <>
      {state === 'sent' && <span className="text-pitch-600">Sent — it can take a minute. Check spam too.</span>}
      {state === 'failed' && <span className="text-kit-600">Couldn&apos;t send it just now. Try again in a minute.</span>}
    </>
  );
}

/** Re-read the account whenever the person comes back to this tab — they may have just tapped the link. */
function useCheckOnReturn(active: boolean, onCheck: () => Promise<void>) {
  useEffect(() => {
    if (!active) return;
    const onFocus = () => void onCheck();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [active, onCheck]);
}

/**
 * Asks an organiser who hasn't confirmed their email to do so. Verifying isn't
 * required to use the app, so it can be put off for the current session. The
 * reminder returns the next time the user signs in. Clicking outside or
 * pressing Escape only closes it for now, and Settings always has the resend
 * button (VerifyEmailRow). It goes away by itself once they've verified.
 */
export function VerifyEmailModal({ email, onCheck }: { email: string; onCheck: () => Promise<void> }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const { state, resend } = useResend();
  useCheckOnReturn(open, onCheck);

  // Open after mount so the reminder appears on every sign-in for an account
  // whose email is still unverified.
  useEffect(() => setOpen(true), []);

  /** Closed until the next page load. */
  const close = () => setOpen(false);

  /** Their explicit choice: close it for this session. */
  function later() {
    close();
  }

  if (!open) return null;

  return (
    <Sheet titleId={titleId} onClose={close} art={<Envelope className="w-44 h-auto animate-float" />}>
      <h2 id={titleId} className="text-xl font-extrabold text-ink">
        Check your inbox
      </h2>
      <p className="text-sm text-gray-500 mt-1.5">
        We sent a link to
        <span className="block font-bold text-ink [overflow-wrap:anywhere]">{email}</span>
        Tap it to confirm it&apos;s you and keep your club&apos;s account safe.
      </p>

      <p role="status" className="min-h-5 mt-3 text-xs font-semibold">
        <SendStatus state={state} />
      </p>

      <div className="mt-2 space-y-2">
        <button
          autoFocus
          onClick={resend}
          disabled={state === 'sending' || state === 'sent'}
          className="w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {state === 'sending' && <BallSpinner />}
          {state === 'sent' ? 'Email sent' : 'Send it again'}
        </button>
        <button onClick={later} className="w-full py-3 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
          I&apos;ll do it later
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Shown once the account turns verified while the app is open — they tapped
 * the link on another device or tab and came back here.
 */
export function EmailVerifiedModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  return (
    <>
      <Confetti />
      <Sheet titleId={titleId} onClose={onClose} art={<Celebration className="w-48 h-auto animate-float" />}>
        <h2 id={titleId} className="text-xl font-extrabold text-ink">
          Congratulations!
        </h2>
        <p className="text-sm text-gray-500 mt-1.5">Your email is verified. Your club&apos;s account is safe and you&apos;re all set.</p>
        <button
          autoFocus
          onClick={onClose}
          className="mt-5 w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors"
        >
          Let&apos;s go
        </button>
      </Sheet>
    </>
  );
}

/** Bottom sheet on phones, centred card on larger screens. Escape or a tap outside closes it. */
function Sheet({ titleId, onClose, art, children }: { titleId: string; onClose: () => void; art: ReactNode; children: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    // Stop the page scrolling behind the sheet.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Portal to <body> so the sheet sits above the phone tab bar.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-lift w-full sm:max-w-sm overflow-hidden animate-slide-up sm:animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-volt-300 chalk-dots pt-5 flex justify-center">{art}</div>
        <div className="p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 text-center">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The email line in Settings: the address, whether it's verified, and — until it
 * is — a button to send the link again. Always there, whatever happened to the modal.
 */
export function VerifyEmailRow({ email, verified, onCheck }: { email: string; verified: boolean; onCheck: () => Promise<void> }) {
  const { state, resend } = useResend();
  useCheckOnReturn(!verified, onCheck);

  return (
    <div className="mb-4 rounded-2xl bg-chalk border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Email</p>
          <p className="text-sm font-bold text-ink [overflow-wrap:anywhere]">{email}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            verified ? 'bg-pitch-100 text-pitch-800' : 'bg-sun-400/30 text-amber-900'
          }`}
        >
          {verified ? 'Verified' : 'Not verified'}
        </span>
      </div>

      {!verified && (
        <div className="mt-3">
          <p className="text-xs text-gray-500">We sent a link to this address. Tap it to confirm it&apos;s you and keep your club&apos;s account safe.</p>
          <button
            type="button"
            onClick={resend}
            disabled={state === 'sending' || state === 'sent'}
            className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold text-ink bg-white border border-gray-200 rounded-xl hover:border-ink transition-colors disabled:opacity-50"
          >
            {state === 'sending' && <BallSpinner />}
            {state === 'sent' ? 'Email sent' : 'Send verification email'}
          </button>
          <p role="status" className="min-h-4 mt-1.5 text-xs font-semibold">
            <SendStatus state={state} />
          </p>
        </div>
      )}
    </div>
  );
}
