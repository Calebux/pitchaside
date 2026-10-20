'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { Avatar } from '@/components/ratings';
import { stagger } from '@/components/motion';
import { btnPrimary } from '@/components/buttons';
import type { Lineup, TeamKey } from '@/lib/api';
import { TEAMS, bibFill, bibOf, bibTint, teamName } from '@/lib/teams';
import { Swatch, shortName } from './teams-step';

type Member = Lineup['squad'][number];

/**
 * A goal for one side, on one screen: tap who scored, then (optional) who set it up, and the
 * button says what's saved ("Add goal: Emeka · 3–1"). Only that side's players. "Not sure who"
 * counts the goal without a name, so the score is never held up by it.
 */
export function ScorerSheet({
  team,
  lineup,
  onPick,
  onClose,
  allowUnnamed = true,
  scoreAfter,
}: {
  team: TeamKey;
  lineup: Lineup;
  /** scorerId null: a goal nobody saw clearly. */
  onPick: (goal: { scorerId: string | null; assistId: string | null }) => void;
  onClose: () => void;
  /** Off when naming a goal already on the scoreboard. */
  allowUnnamed?: boolean;
  /** The score once this goal is in, e.g. "3–1", for the button. */
  scoreAfter?: string;
}) {
  const titleId = useId();
  const [scorer, setScorer] = useState<Member | null>(null);
  const [assist, setAssist] = useState<Member | null>(null);
  const side = lineup.squad.filter((m) => m.team === team).sort((a, b) => shortName(a).localeCompare(shortName(b)));
  const name = teamName(team, lineup.captains, lineup.bibs);

  const footer = (
    <div className="space-y-2">
      <button
        disabled={!scorer}
        onClick={() => scorer && onPick({ scorerId: scorer.id, assistId: assist?.id ?? null })}
        className={`${btnPrimary} w-full`}
      >
        {scorer ? `Add goal: ${shortName(scorer)}${assist ? ` (${shortName(assist)})` : ''}${scoreAfter ? ` · ${scoreAfter}` : ''}` : 'Tap who scored'}
      </button>
      {allowUnnamed && !scorer && (
        <button
          onClick={() => onPick({ scorerId: null, assistId: null })}
          className="press w-full min-h-11 rounded-2xl text-[14px] font-bold text-gray-600 hover:text-ink"
        >
          Not sure who · just add the goal
        </button>
      )}
    </div>
  );

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left" footer={footer}>
      <SheetTitle
        id={titleId}
        title={`Goal for ${name}: who scored?`}
        sub="Their goal goes on their record."
        onClose={onClose}
      />
      <ul className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Who scored">
        {side.map((m, i) => {
          const on = scorer?.id === m.id;
          return (
            <li key={m.id} className="animate-rise min-w-0" style={stagger(i, 25, 20)}>
              <button
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setScorer(on ? null : m);
                  if (assist?.id === m.id) setAssist(null);
                }}
                className={`press w-full flex flex-col items-center gap-1 min-h-[84px] px-1.5 py-2 rounded-2xl border-2 text-center transition-colors ${
                  on ? 'border-ink bg-volt-300 shadow-sticker' : 'border-gray-100 bg-white hover:border-gray-300'
                }`}
              >
                <Avatar name={`${m.firstName} ${m.lastName}`} photoKey={m.photoKey} className="w-9 h-9 text-[11px]" />
                <span className="w-full truncate text-[13px] font-bold text-ink">{shortName(m)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {scorer && side.length > 1 && (
        <section className="mt-5 animate-fade-in-up" aria-labelledby={`${titleId}-assist`}>
          <h3 id={`${titleId}-assist`} className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
            <Swatch team={team} bibs={lineup.bibs} />
            Who set it up? <span className="font-semibold text-gray-500">(optional)</span>
          </h3>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${titleId}-assist`}>
            {[null, ...side.filter((m) => m.id !== scorer.id)].map((m) => {
              const on = (assist?.id ?? null) === (m?.id ?? null);
              return (
                <button
                  key={m?.id ?? 'none'}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAssist(m)}
                  className={`press min-h-11 px-3.5 rounded-full border text-[13px] font-bold transition-colors ${
                    on ? 'border-ink bg-ink text-volt-300' : 'border-gray-200 bg-white text-ink hover:border-ink'
                  }`}
                >
                  {m ? shortName(m) : 'No assist'}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </Sheet>
  );
}
