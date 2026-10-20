'use client';

import { useId, useState } from 'react';
import { BIB_COLOURS, BIB_COLOUR_KEYS, DEFAULT_BIBS, TEAM_NAME_MAX, type BibColour, type Bibs } from '@pitchaside/shared';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary, btnSecondary } from '@/components/buttons';
import { BibShirt } from '@/components/bib-shirt';
import { bibOf } from '@/lib/teams';
import type { TeamKey } from '@/lib/api';

const SIDES = Object.keys(DEFAULT_BIBS) as TeamKey[];

/** Every side's bib as it stands, so a save never drops the sides not shown. */
function fill(bibs: Bibs | null | undefined): Record<TeamKey, { colour: BibColour; name: string }> {
  return Object.fromEntries(SIDES.map((s) => [s, { colour: bibOf(s, bibs).colour, name: bibOf(s, bibs).name ?? '' }])) as Record<
    TeamKey,
    { colour: BibColour; name: string }
  >;
}

/**
 * Picking what each team wears and is called: a colour from the bibs most groups own, and an
 * optional name ("Red Devils") that shows instead of the colour everywhere, players' side too.
 * The same sheet sets a group's usual bibs and one game's bibs.
 */
export function BibsSheet({
  title,
  sub,
  current,
  shown,
  more,
  saving,
  saveLabel = 'Save bibs',
  resetLabel,
  onSave,
  onReset,
  onClose,
}: {
  title: string;
  sub: string;
  /** What the teams wear now (null: the default colours). */
  current: Bibs | null | undefined;
  /** How many teams to show at first. */
  shown: number;
  /** Let them open up all six teams (group settings, where the number of teams isn't known). */
  more?: boolean;
  saving: boolean;
  /** The main button's words; "Save bibs" unless the change is saved later with something else. */
  saveLabel?: string;
  /** The quiet second button, e.g. "Back to the usual colours". Left out, there's no reset. */
  resetLabel?: string;
  onSave: (bibs: Bibs) => void;
  onReset?: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [kits, setKits] = useState(() => fill(current));
  const [count, setCount] = useState(shown);
  const sides = SIDES.slice(0, count);
  const set = (s: TeamKey, patch: Partial<{ colour: BibColour; name: string }>) => setKits((k) => ({ ...k, [s]: { ...k[s], ...patch } }));
  const twin = (s: TeamKey) => sides.find((o) => o !== s && kits[o].colour === kits[s].colour);

  function save() {
    const out: Bibs = {};
    for (const s of SIDES) {
      const name = kits[s].name.trim().replace(/\s+/g, ' ');
      out[s] = { colour: kits[s].colour, ...(name ? { name } : {}) };
    }
    onSave(out);
  }

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        <div className="space-y-2">
          <button onClick={save} disabled={saving} className={`${btnPrimary} w-full`}>
            {saving ? 'Saving…' : saveLabel}
          </button>
          {resetLabel && onReset && (
            <button onClick={onReset} disabled={saving} className={`${btnSecondary} w-full`}>
              {resetLabel}
            </button>
          )}
        </div>
      }
    >
      <SheetTitle id={titleId} title={title} sub={sub} onClose={onClose} />

      <ol className="mt-5 space-y-5">
        {sides.map((s, i) => {
          const kit = kits[s];
          const colour = BIB_COLOURS[kit.colour];
          const same = twin(s);
          const nameId = `${titleId}-${s}-name`;
          return (
            <li key={s}>
              <fieldset className="min-w-0">
                <legend className="w-full flex items-center gap-3">
                  <BibShirt team={s} bibs={{ [s]: { colour: kit.colour } }} label={String(i + 1)} className="w-11 h-11 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-display text-[17px] font-extrabold text-ink leading-tight truncate">{kit.name.trim() || colour.label}</span>
                    <span className="block text-[12px] font-semibold text-gray-600">
                      Team {i + 1} · {colour.label} bibs
                    </span>
                  </span>
                </legend>

                {/* Colours: a row you swipe, each a full tap target, ticked when picked */}
                <div className="-mx-6 mt-2 px-6 py-1.5 flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {BIB_COLOUR_KEYS.map((c) => {
                    const on = kit.colour === c;
                    const k = BIB_COLOURS[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        aria-label={k.label}
                        title={k.label}
                        onClick={() => set(s, { colour: c })}
                        className={`press shrink-0 w-11 h-11 rounded-full grid place-items-center transition-shadow ${
                          on ? 'ring-[3px] ring-ink ring-offset-2' : c === 'white' ? 'ring-1 ring-inset ring-gray-300' : ''
                        }`}
                        style={{ backgroundColor: k.hex }}
                      >
                        {on && (
                          <svg className={`w-5 h-5 ${k.ink ? 'text-ink' : 'text-white'}`} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                {same && (
                  <p className="mt-1.5 text-[12px] font-semibold text-kit-600">
                    Same colour as team {sides.indexOf(same) + 1}. Fine if you have two sets; players tell sides apart by name.
                  </p>
                )}

                <label htmlFor={nameId} className="sr-only">
                  Team {i + 1} name
                </label>
                <input
                  id={nameId}
                  value={kit.name}
                  maxLength={TEAM_NAME_MAX}
                  onChange={(e) => set(s, { name: e.target.value })}
                  placeholder={`Name (optional), e.g. ${i % 2 ? 'Galacticos' : 'Red Devils'}`}
                  className="mt-2 w-full min-h-12 px-3.5 bg-white border border-gray-200 rounded-xl text-[15px] placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600"
                />
              </fieldset>
            </li>
          );
        })}
      </ol>

      {more && count < SIDES.length && (
        <button type="button" onClick={() => setCount(SIDES.length)} className="press mt-4 w-full min-h-12 rounded-xl text-[14px] font-bold text-pitch-700 hover:bg-chalk">
          + Teams {count + 1}–{SIDES.length}, for days with more teams
        </button>
      )}
      <p className="mt-4 text-[12px] leading-snug text-gray-500">A name shows instead of the colour or “Team” and the captain’s name, on scores, the table and the vote, for players too.</p>
    </Sheet>
  );
}
