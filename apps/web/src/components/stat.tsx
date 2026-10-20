'use client';

/** One of the card's two numbers: what it is, the figure, a line under it, and a bar when it's a share. */
export function Stat({
  label,
  value,
  of,
  note,
  share,
  tone = 'ink',
}: {
  label: string;
  value: string;
  of?: string;
  note: string;
  share?: number | null;
  tone?: 'ink' | 'warn' | 'muted';
}) {
  return (
    <span className="min-w-0 block">
      <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">{label}</span>
      <span
        className={`mt-0.5 block font-display text-[20px] leading-tight font-extrabold tabular-nums truncate ${
          tone === 'warn' ? 'text-amber-700' : tone === 'muted' ? 'text-gray-400' : 'text-ink'
        }`}
      >
        {value}
        {of && <span className="text-[14px] font-bold text-gray-400">{of}</span>}
      </span>
      {share != null && (
        <span className="mt-1 block h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
          <span
            className={`block h-full rounded-full animate-fill-grow ${tone === 'warn' ? 'bg-sun-400' : 'bg-pitch-600'}`}
            style={{ width: `${Math.max(share > 0 ? 4 : 0, Math.min(100, share))}%` }}
          />
        </span>
      )}
      <span className={`mt-1 block text-[12px] leading-snug truncate ${tone === 'warn' ? 'text-amber-800 font-semibold' : 'text-gray-600'}`}>{note}</span>
    </span>
  );
}
