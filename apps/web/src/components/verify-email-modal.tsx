'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Envelope } from '@/components/illustrations';
import { BallSpinner } from '@/components/skeleton';
import { resendVerification } from '@/lib/api';

/**
 * Asks an organiser who hasn't confirmed their email to do so. Verifying isn't
 * required to use the app, so it can be put off for the current session — it
 * comes back the next time the user signs in.
 * `onCheck` re-reads the account, so the reminder goes away by itself once they
 * tap the link in another tab and come back.
 */
export function VerifyEmailModal({ email, onCheck }: { email: string; onCheck: () => Promise<void> }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  // Open after mount so the modal is rendered client-side and appears on every
  // sign-in for an account whose email is still unverified.
  useEffect(() => setOpen(true), []);

  function later() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && later();
    const onFocus = () => void onCheck();
    window.addEventListener('keydown', onKey);
    window.addEventListener('focus', onFocus);
    // Stop the page scrolling behind the sheet.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('focus', onFocus);
      document.body.style.overflow = overflow;
    };
  }, [open, onCheck]);

  async function resend() {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  if (!open) return null;

  // Portal to <body> so the sheet sits above the phone tab bar.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={later}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-lift w-full sm:max-w-sm overflow-hidden animate-slide-up sm:animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-volt-300 chalk-dots pt-5 flex justify-center">
          <Envelope className="w-44 h-auto animate-float" />
        </div>

        <div className="p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 text-center">
          <h2 id={titleId} className="text-xl font-extrabold text-ink">
            Check your inbox
          </h2>
          <p className="text-sm text-gray-500 mt-1.5">
            We sent a link to
            <span className="block font-bold text-ink [overflow-wrap:anywhere]">{email}</span>
            Tap it to confirm it&apos;s you and keep your club&apos;s account safe.
          </p>

          <p role="status" className="min-h-5 mt-3 text-xs font-semibold">
            {state === 'sent' && <span className="text-pitch-600">Sent — it can take a minute. Check spam too.</span>}
            {state === 'failed' && <span className="text-kit-600">Couldn&apos;t send it just now. Try again in a minute.</span>}
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
