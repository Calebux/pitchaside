import type { Bibs } from '@pitchaside/shared';
import { bibOf } from '@/lib/teams';
import type { TeamKey } from '@/lib/api';

const SHIRT_PATH = 'M14 6 L19 4 Q24 8 29 4 L34 6 L45 13 L40 22 L35 19 L35 44 L13 44 L13 19 L8 22 L3 13 Z';

/**
 * A bib in a side's colour with a short label on it (initials, a number). No side: white.
 * `empty` draws a dashed outline for a spot still to fill. Decorative: say the side in words beside it.
 */
export function BibShirt({
  team,
  bibs,
  label,
  empty = false,
  className = 'w-10 h-10',
}: {
  team?: TeamKey | null;
  /** The game's bibs, so the shirt is the colour that side actually wears. */
  bibs?: Bibs | null;
  label?: string;
  empty?: boolean;
  className?: string;
}) {
  const kit = team ? bibOf(team, bibs) : null;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        d={SHIRT_PATH}
        fill={empty ? 'transparent' : (kit?.hex ?? '#ffffff')}
        stroke={empty ? 'currentColor' : '#0f1a14'}
        strokeWidth={empty ? 2 : 2.2}
        strokeDasharray={empty ? '4 3' : undefined}
        strokeLinejoin="round"
      />
      {label && (
        <text
          x="24"
          y="34"
          textAnchor="middle"
          fontSize={label.length > 2 ? 9 : label.length > 1 ? 11.5 : 14}
          fontWeight="800"
          fontFamily="var(--font-heading), sans-serif"
          fill={empty ? 'currentColor' : !kit || kit.ink ? '#0f1a14' : '#ffffff'}
        >
          {label}
        </text>
      )}
    </svg>
  );
}
