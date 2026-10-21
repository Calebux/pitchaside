'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Scene } from '@/components/onboarding/tour';
import { loadingTips, type Side } from '@/lib/onboarding';

/** Which app a page belongs to, for which tips fit. */
function sideOf(path: string): Side | null {
  if (/^\/(me|g|join|v|card)(\/|$)/.test(path)) return 'player';
  if (/^\/(signin|signup|forgot-password|reset-password)(\/|$)/.test(path) || path === '/') return null;
  return 'organiser';
}

/**
 * Under a loading spinner: nothing for a quick load, then a "Did you know you can…" with its
 * picture after a moment, and the next one every few seconds while the wait goes on. A longer
 * wait sees more of them.
 */
export function LoadingTip() {
  const path = usePathname() ?? '';
  const side = sideOf(path);
  const [tips] = useState(() => {
    const all = side ? loadingTips(side) : [];
    // A different first tip each time.
    const start = all.length ? Math.floor(Math.random() * all.length) : 0;
    return [...all.slice(start), ...all.slice(0, start)];
  });
  const [n, setN] = useState(-1);

  useEffect(() => {
    if (!tips.length) return;
    const first = window.setTimeout(() => setN(0), 1200);
    const next = window.setInterval(() => setN((x) => (x < 0 ? x : x + 1)), 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(next);
    };
  }, [tips.length]);

  if (n < 0 || !tips.length) return null;
  const tip = tips[n % tips.length];
  return (
    <div key={tip.id} className="mt-6 w-full max-w-xs rounded-3xl bg-white border border-gray-100 shadow-card p-4 text-center animate-rise" aria-live="polite">
      <div aria-hidden>
        <Scene name={tip.scene} className="w-40 h-auto mx-auto" />
      </div>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-pitch-600">While you wait</p>
      <p className="mt-0.5 font-display text-[15px] leading-tight font-extrabold text-ink">{tip.q}</p>
      <p className="mt-1 text-[13px] leading-snug text-gray-600">{tip.a}</p>
    </div>
  );
}
