'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_BIBS } from '@pitchaside/shared';
import { BibShirt } from '@/components/bib-shirt';
import { btnSecondary } from '@/components/buttons';
import type { IGroupWithMembers, TeamKey } from '@/lib/api';

const SIDES = (Object.keys(DEFAULT_BIBS) as TeamKey[]).slice(0, 3);
const seenKey = (groupId: string) => `pa_seen_matchday_${groupId}`;

/**
 * Once, for groups set up before match-day settings existed: bibs, team names and the timer are
 * new, and here's where to set them. Gone after "Set it up" or "Hide", and for good once the group
 * has a game length or bibs saved (new groups set those when they're made).
 */
export function MatchDayNews({ group, onSetUp }: { group: IGroupWithMembers; onSetUp: () => void }) {
  const [show, setShow] = useState(false);
  const untouched = group.gameMinutes == null && group.bibs == null;

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(group.id)) === '1';
    } catch {}
    setShow(untouched && !seen);
  }, [group.id, untouched]);

  const done = () => {
    try {
      localStorage.setItem(seenKey(group.id), '1');
    } catch {}
    setShow(false);
  };

  if (!show) return null;
  return (
    <section aria-labelledby="matchday-news-title" className="mt-3 relative rounded-3xl bg-white border border-gray-100 shadow-card px-5 py-4 animate-fade-in-up">
      <button
        type="button"
        onClick={done}
        aria-label="Hide this"
        className="press absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center text-gray-500 hover:bg-chalk hover:text-ink"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-center gap-3 pr-10">
        <span className="flex -space-x-2 shrink-0" aria-hidden>
          {SIDES.map((s) => (
            <BibShirt key={s} team={s} bibs={null} className="w-9 h-9" />
          ))}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-volt-400 text-ink text-[11px] font-extrabold uppercase tracking-wide">New</span>
      </div>
      <h2 id="matchday-news-title" className="mt-2.5 font-display text-[18px] leading-tight font-extrabold text-ink">
        Bibs, team names and a match timer
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-gray-600">
        Pick the colours {group.name} wears and how long each game lasts. The timer is on for match day; turn it off if the pitch keeps the time.
      </p>
      <button
        type="button"
        onClick={() => {
          done();
          onSetUp();
        }}
        className={`${btnSecondary} mt-3 w-full`}
      >
        Set up match day
      </button>
    </section>
  );
}
