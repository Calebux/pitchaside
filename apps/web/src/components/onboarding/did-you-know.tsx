'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scene } from '@/components/onboarding/tour';
import { markTipSeen, pickTip, type Side, type Tip, type TipContext } from '@/lib/onboarding';

/**
 * Now and then on the home screen (at most every few days), one "Did you know?" picked for what's
 * going on: someone owes, a vote is open, no photo yet; otherwise something useful they may have
 * missed. "Got it" or its button puts it away for good.
 */
export function DidYouKnow({ side, context, className = '' }: { side: Side; context: TipContext; className?: string }) {
  const [tip, setTip] = useState<Tip | null>(null);
  // Picked once per visit, after the page knows what's going on.
  const ready = JSON.stringify(context);
  useEffect(() => {
    setTip((t) => t ?? pickTip(side, context));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ready` stands for the context
  }, [side, ready]);
  if (!tip) return null;

  const done = () => {
    markTipSeen(tip.id);
    setTip(null);
  };

  return (
    <section aria-labelledby={`tip-${tip.id}`} className={`relative overflow-hidden rounded-3xl bg-volt-300 border-2 border-ink shadow-sticker animate-pop-in ${className}`}>
      <div className="absolute inset-0 chalk-dots opacity-60 pointer-events-none" aria-hidden />
      <div className="relative flex gap-3 p-4">
        <div className="w-28 shrink-0 -my-1 -ml-1" aria-hidden>
          <Scene name={tip.scene} className="w-full h-auto" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/60">Did you know?</p>
          <h2 id={`tip-${tip.id}`} className="mt-0.5 font-display text-[16px] leading-tight font-extrabold text-ink">
            {tip.q}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink/80">{tip.a}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {tip.action && (
              <Link href={tip.action.href} onClick={done} className="press inline-flex items-center min-h-11 px-4 rounded-xl bg-ink text-volt-300 text-[13px] font-bold">
                {tip.action.label}
              </Link>
            )}
            <button onClick={done} className="press inline-flex items-center min-h-11 px-3 rounded-xl text-[13px] font-bold text-ink hover:bg-ink/5">
              Got it
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
