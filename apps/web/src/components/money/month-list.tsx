'use client';

import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/api';

type Month<T> = { key: string; label: string; total: number; items: T[] };

/** Newest first (the list's own order), bucketed by calendar month with what moved that month. */
function byMonth<T>(items: T[], dateOf: (t: T) => string, amountOf: (t: T) => number): Month<T>[] {
  const months: Month<T>[] = [];
  const thisYear = new Date().getFullYear();
  for (const t of items) {
    const d = new Date(dateOf(t));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      const label = d.toLocaleDateString('en-GB', { month: 'long', ...(d.getFullYear() !== thisYear && { year: 'numeric' }) });
      months.push((m = { key, label, total: 0, items: [] }));
    }
    m.items.push(t);
    m.total += amountOf(t);
  }
  return months;
}

/**
 * Transactions in one card per month, like a bank app: the month and what came in (or went out)
 * on top, then each one with its own date. While scrolling, the month you're in stays at the
 * top of the screen; not while searching, when the results are a short list anyway.
 */
export function MonthList<T>({
  items,
  idOf,
  dateOf,
  amountOf,
  direction,
  sticky,
  idPrefix = 'row-',
  children,
}: {
  items: T[];
  idOf: (t: T) => string;
  dateOf: (t: T) => string;
  /** What counts towards the month's total (0 for anything that didn't really move). */
  amountOf: (t: T) => number;
  direction: 'in' | 'out';
  sticky: boolean;
  /** Each row's element id is this plus its id, so a link can scroll to it. */
  idPrefix?: string;
  children: (t: T) => ReactNode;
}) {
  return (
    <div className="space-y-3">
      {byMonth(items, dateOf, amountOf).map((m) => (
        <section key={m.key} aria-label={m.label} className="bg-white rounded-3xl border border-gray-100 shadow-card">
          <div
            className={`${sticky ? 'sticky top-safe z-10' : ''} flex items-baseline justify-between gap-3 px-4 py-3 bg-white/95 backdrop-blur rounded-t-3xl border-b border-gray-100`}
          >
            <h3 className="font-display text-[17px] font-extrabold text-ink">{m.label}</h3>
            <p className="text-[13px] text-gray-500 tabular-nums">
              {direction === 'in' ? 'In' : 'Out'} <span className="font-bold text-ink">{formatCurrency(m.total)}</span>
              <span className="text-gray-400"> · {m.items.length}</span>
            </p>
          </div>
          <ul className="divide-y divide-gray-100 text-left">
            {m.items.map((t, i) => (
              <li key={idOf(t)} id={`${idPrefix}${idOf(t)}`} className={`scroll-mt-24 ${i === m.items.length - 1 ? 'rounded-b-3xl overflow-hidden' : ''}`}>
                {children(t)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
