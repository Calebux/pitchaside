'use client';

export type Step = 'players' | 'teams' | 'scores' | 'full';
export const STEPS: Step[] = ['players', 'teams', 'scores', 'full'];

export interface StepInfo {
  /** One short line under the label: "16 in", "2 teams", "3 games". */
  status: string;
  /** Finished: shows a tick, said in words too. */
  done?: boolean;
  /** Needs the organiser: shown in amber, said in words too. */
  attention?: boolean;
}

const LABELS: Record<Step, string> = { players: 'Players', teams: 'Teams', scores: 'Scores', full: 'Full time' };

/** A small picture for each step, beside its name: people, a bib, a scoreboard, a whistle. */
const ICONS: Record<Step, React.ReactNode> = {
  players: (
    <path d="M15 19.13a9.38 9.38 0 0 0 2.63.37 9.34 9.34 0 0 0 4.12-.95 4.13 4.13 0 0 0-7.53-2.49M15 19.13v-.01c0-1.11-.29-2.16-.79-3.07M15 19.13v.1A12.32 12.32 0 0 1 8.62 21c-2.33 0-4.51-.64-6.37-1.77v-.11a6.38 6.38 0 0 1 11.96-3.07M12 6.38a3.38 3.38 0 1 1-6.75 0 3.38 3.38 0 0 1 6.75 0Zm8.25 2.25a2.63 2.63 0 1 1-5.25 0 2.63 2.63 0 0 1 5.25 0Z" />
  ),
  teams: <path d="M8.5 3.5 6 4.5 2.5 8l2 3.5L6.5 10v10.5h11V10l2 1.5 2-3.5L18 4.5l-2.5-1c-.5 1.5-1.9 2.5-3.5 2.5S9 5 8.5 3.5Z" />,
  scores: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M12 5v14M7.5 10v4M15.5 10h2v2h-2v2h2" />
    </>
  ),
  full: (
    <>
      <circle cx="9" cy="14" r="5" />
      <path d="M12.5 10.5 21 6v4l-6.5 2.2M9 14h.01" />
    </>
  ),
};

/**
 * The game's four steps in one bar that stays at the top while scrolling: who's in, teams,
 * scores, full time. Each says where it stands in a word or two, so the organiser sees the whole
 * match day at a glance and jumps straight to the step they need.
 */
export function GameSteps({ current, info, onPick }: { current: Step; info: Record<Step, StepInfo>; onPick: (s: Step) => void }) {
  return (
    <>
      {/* Where the bar sits before it sticks: switching steps scrolls back up to here */}
      <div id="game-steps-anchor" className="mt-2" aria-hidden />
      <div className="sticky top-safe z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 mb-2 bg-chalk/95 backdrop-blur">
      <div className="grid grid-cols-4 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="Match day steps">
        {STEPS.map((s) => {
          const on = s === current;
          const { status, done, attention } = info[s];
          return (
            <button
              key={s}
              role="tab"
              aria-selected={on}
              onClick={() => onPick(s)}
              className={`press min-w-0 min-h-[52px] px-1 rounded-xl flex flex-col items-center justify-center transition-colors ${
                on ? 'bg-ink text-white' : 'text-ink hover:bg-chalk'
              }`}
            >
              <span className="flex items-center gap-1 text-[13px] font-bold leading-tight">
                {done ? (
                  <span className="w-4 h-4 shrink-0 rounded-full bg-volt-400 text-ink text-[10px] font-extrabold leading-4 text-center" aria-hidden>
                    ✓
                  </span>
                ) : (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {ICONS[s]}
                  </svg>
                )}
                <span className="truncate">{LABELS[s]}</span>
              </span>
              <span
                className={`mt-0.5 max-w-full truncate text-[11px] font-semibold tabular-nums ${
                  attention ? (on ? 'text-sun-400' : 'text-amber-700') : on ? 'text-volt-300' : 'text-gray-500'
                }`}
              >
                {status}
                {done && <span className="sr-only">, done</span>}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </>
  );
}
