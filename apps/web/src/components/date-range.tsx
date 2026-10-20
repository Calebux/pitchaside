'use client';

import { useState } from 'react';
import { btnPrimary } from '@/components/buttons';

export type DateRange = { from: string; to: string };

/** "17 Oct – 20 Oct", "From 17 Oct", "Until 20 Oct": a picked date range, short. */
export function rangeLabel({ from, to }: DateRange) {
  const f = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (from && to) return `${f(from)} – ${f(to)}`;
  return from ? `From ${f(from)}` : `Until ${f(to)}`;
}

/** Whether a moment falls on or between the picked days (either end may be open). */
export function inRange(iso: string, { from, to }: DateRange) {
  const day = new Date(iso).toLocaleDateString('en-CA');
  return (!from || day >= from) && (!to || day <= to);
}

/**
 * From and To, picked inside a filter's dropdown. Nothing changes the list until "Show" is
 * tapped, so half-picked dates never flash an empty list.
 */
export function DateRangePicker({
  value,
  onApply,
  onClear,
  showLabel = 'Show',
}: {
  value: DateRange;
  onApply: (r: DateRange) => void;
  /** Shown only when dates are already applied: back to any time. */
  onClear?: () => void;
  showLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const today = new Date().toLocaleDateString('en-CA');
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {(['from', 'to'] as const).map((k) => (
          <label key={k} className="block min-w-0">
            <span className="block px-1 mb-1 text-[12px] font-semibold text-gray-500">{k === 'from' ? 'From' : 'To'}</span>
            <input
              type="date"
              value={draft[k]}
              max={(k === 'from' ? draft.to : '') || today}
              min={k === 'to' ? draft.from || undefined : undefined}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              className="block w-full min-w-0 h-11 px-3 appearance-none bg-chalk border border-gray-200 rounded-2xl text-[15px] text-ink text-left [&::-webkit-date-and-time-value]:text-left focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600"
            />
          </label>
        ))}
      </div>
      <button type="button" disabled={!draft.from && !draft.to} onClick={() => onApply(draft)} className={`${btnPrimary} mt-3 w-full`}>
        {showLabel}
      </button>
      {onClear && (
        <button type="button" onClick={onClear} className="mt-1 w-full min-h-11 text-sm font-bold text-pitch-700">
          Clear dates
        </button>
      )}
    </div>
  );
}
