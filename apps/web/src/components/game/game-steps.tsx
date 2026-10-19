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
        {STEPS.map((s, i) => {
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
                <span
                  className={`w-4 h-4 shrink-0 rounded-full text-[10px] font-extrabold leading-4 text-center ${
                    done ? 'bg-volt-400 text-ink' : on ? 'bg-white/15 text-white' : 'bg-chalk text-gray-600'
                  }`}
                  aria-hidden
                >
                  {done ? '✓' : i + 1}
                </span>
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
