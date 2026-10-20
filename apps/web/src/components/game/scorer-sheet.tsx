'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { Avatar } from '@/components/ratings';
import { stagger } from '@/components/motion';
import type { Lineup, TeamKey } from '@/lib/api';
import { teamName } from '@/lib/teams';
import { shortName } from './teams-step';

type Member = Lineup['squad'][number];

/**
 * A goal for one side: tap who scored, then who set it up (or "No assist"). Two taps, both
 * from that side's players only. "Not sure who" counts the goal without a name, so the score is
 * never held up by it.
 */
export function ScorerSheet({
  team,
  lineup,
  onPick,
  onClose,
  allowUnnamed = true,
}: {
  team: TeamKey;
  lineup: Lineup;
  /** scorerId null: a goal nobody saw clearly. */
  onPick: (goal: { scorerId: string | null; assistId: string | null }) => void;
  onClose: () => void;
  /** Off when naming a goal already on the scoreboard. */
  allowUnnamed?: boolean;
}) {
  const titleId = useId();
  const [scorer, setScorer] = useState<Member | null>(null);
  const side = lineup.squad.filter((m) => m.team === team).sort((a, b) => shortName(a).localeCompare(shortName(b)));
  const choices = scorer ? side.filter((m) => m.id !== scorer.id) : side;

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left">
      <SheetTitle
        id={titleId}
        title={scorer ? `Who set up ${shortName(scorer)}?` : `Who scored for ${teamName(team, lineup.captains)}?`}
        sub={scorer ? 'The pass or cross that made the goal.' : 'Their goal goes on their record.'}
        onClose={onClose}
      />
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {choices.map((m, i) => (
          <li key={m.id} className="animate-rise" style={stagger(i, 25, 20)}>
            <button
              onClick={() => (scorer ? onPick({ scorerId: scorer.id, assistId: m.id }) : setScorer(m))}
              className="press w-full flex items-center gap-2.5 min-h-12 px-3 rounded-2xl border border-gray-200 text-left hover:border-ink"
            >
              <Avatar name={`${m.firstName} ${m.lastName}`} photoKey={m.photoKey} className="w-8 h-8 text-[11px]" />
              <span className="min-w-0 text-[14px] font-bold text-ink truncate">{shortName(m)}</span>
            </button>
          </li>
        ))}
      </ul>
      {scorer ? (
        <button
          onClick={() => onPick({ scorerId: scorer.id, assistId: null })}
          className="press mt-3 w-full min-h-12 rounded-2xl bg-ink text-volt-300 text-[15px] font-bold"
        >
          No assist
        </button>
      ) : (
        allowUnnamed && (
          <button
            onClick={() => onPick({ scorerId: null, assistId: null })}
            className="press mt-3 w-full min-h-12 rounded-2xl border border-gray-300 text-[15px] font-bold text-ink hover:border-ink"
          >
            Not sure who · just add the goal
          </button>
        )
      )}
    </Sheet>
  );
}
