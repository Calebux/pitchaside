'use client';

import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary, btnSecondary } from '@/components/buttons';
import { Celebration } from '@/components/illustrations';
import { SceneBank, SceneCard, SceneInvite, SceneKit, SceneMatchDay, ScenePayout, SceneTicket, SceneVote } from '@/components/onboarding/scenes';
import { getGroups } from '@/lib/api';
import { TOURS, TOUR_END, TOUR_EVENT, markTourSeen, tourSeen, type SceneKey, type Side } from '@/lib/onboarding';

/** Each scene by name, so the words (lib/onboarding.ts) can say which picture goes with them. */
export function Scene({ name, className }: { name: SceneKey; className?: string }) {
  const S = { welcome: Celebration, kit: SceneKit, bank: SceneBank, invite: SceneInvite, ticket: SceneTicket, matchday: SceneMatchDay, vote: SceneVote, card: SceneCard, payout: ScenePayout }[name];
  return <S className={className} />;
}

/**
 * The walkthrough: one step per sheet page, a picture on top, a few short lines, Back and Next
 * at the bottom (swipe works too), and the dots to show how far. The last step ends on the first
 * real thing to do. Closing it any time counts as seen.
 */
function Tour({ side, done: doneProp, onClose }: { side: Side; done?: boolean; onClose: () => void }) {
  const titleId = useId();
  const router = useRouter();
  const steps = TOURS[side];
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  const swipe = useRef<number | null>(null);
  const go = (n: number) => setI(Math.max(0, Math.min(steps.length - 1, n)));

  useEffect(() => markTourSeen(side), [side]);

  // Someone who has already done the first thing (made a group, added a photo) just finishes.
  const [hasGroup, setHasGroup] = useState(false);
  useEffect(() => {
    if (side !== 'organiser') return;
    getGroups()
      .then((g) => setHasGroup(g.length > 0))
      .catch(() => {});
  }, [side]);
  const done = doneProp || hasGroup;

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      art={
        <div key={i} className="w-full max-w-[300px] px-6 pb-2 animate-pop-in" aria-hidden>
          <Scene name={step.scene} className="w-full h-auto" />
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          {i > 0 && (
            <button onClick={() => go(i - 1)} className={`${btnSecondary} px-5`}>
              Back
            </button>
          )}
          {last ? (
            <button
              onClick={() => {
                onClose();
                if (!done) router.push(TOUR_END[side].href);
              }}
              className={`${btnPrimary} flex-1`}
            >
              {done ? 'Done' : TOUR_END[side].label}
            </button>
          ) : (
            <button onClick={() => go(i + 1)} className={`${btnPrimary} flex-1`}>
              {i === 0 ? 'Show me how' : 'Next'}
            </button>
          )}
        </div>
      }
    >
      <div
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current == null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-pitch-600">{step.eyebrow}</p>
        <div className="mt-1">
          <SheetTitle id={titleId} title={step.title} onClose={onClose} />
        </div>
        {/* Same height on every step, so the buttons don't jump about */}
        <ul key={i} className="mt-3 space-y-2 min-h-[13rem]">
          {step.lines.map((line, n) => (
            <li key={n} className="flex gap-2.5 text-[15px] leading-snug text-gray-700 animate-rise" style={{ animationDelay: `${60 + n * 70}ms` }}>
              <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-volt-500" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        {/* How far through: tap a dot to jump */}
        <div className="mt-4 flex items-center">
          <div className="flex gap-1.5" role="group" aria-label={`Step ${i + 1} of ${steps.length}`}>
            {steps.map((s, n) => (
              <button
                key={n}
                onClick={() => go(n)}
                aria-label={`Step ${n + 1}: ${s.title}`}
                aria-current={n === i ? 'step' : undefined}
                className="w-6 h-11 -my-4 flex items-center justify-center"
              >
                <span className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-ink' : 'w-2 bg-gray-300'}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Mounted once in each app's frame. Opens the walkthrough on first sign-up (?welcome=1, once per
 * phone), from a menu item (openTour()), or from a ?tour=1 link.
 */
export function TourHost({ side, done }: { side: Side; done?: boolean }) {
  // Reading the address needs a Suspense boundary in Next 15.
  return (
    <Suspense fallback={null}>
      <TourHostInner side={side} done={done} />
    </Suspense>
  );
}

function TourHostInner({ side, done }: { side: Side; done?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const welcome = params.get('welcome') === '1';
    const asked = params.get('tour') === '1';
    if (asked || (welcome && !tourSeen(side))) setOpen(true);
    if (welcome || asked) {
      // Take the flag off the address, so a refresh doesn't open it again.
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      url.searchParams.delete('tour');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [params, side, router]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(TOUR_EVENT, show);
    return () => window.removeEventListener(TOUR_EVENT, show);
  }, []);

  return open ? <Tour side={side} done={done} onClose={() => setOpen(false)} /> : null;
}
