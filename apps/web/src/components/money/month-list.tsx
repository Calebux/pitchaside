'use client';

import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/api';

type Day<T> = { key: string; label: string; total: number; items: T[] };
type Month<T> = { key: string; label: string; total: number; count: number; days: Day<T>[] };

/** "Today", "Yesterday", or e.g. "Sat 17 Oct": how bank apps head each day. */
function dayLabel(d: Date) {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/** Newest first (the list's own order), by month, and within each month by day. */
function byMonth<T>(items: T[], dateOf: (t: T) => string, amountOf: (t: T) => number): Month<T>[] {
  const months: Month<T>[] = [];
  const thisYear = new Date().getFullYear();
  for (const t of items) {
    const d = new Date(dateOf(t));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      const label = d.toLocaleDateString('en-GB', { month: 'long', ...(d.getFullYear() !== thisYear && { year: 'numeric' }) });
      months.push((m = { key, label, total: 0, count: 0, days: [] }));
    }
    const dayKey = `${key}-${d.getDate()}`;
    let day = m.days[m.days.length - 1];
    if (!day || day.key !== dayKey) m.days.push((day = { key: dayKey, label: dayLabel(d), total: 0, items: [] }));
    day.items.push(t);
    day.total += amountOf(t);
    m.total += amountOf(t);
    m.count++;
  }
  return months;
}

/**
 * Transactions in one card per month, like a bank app: the month and what came in (or went out)
 * on top, then day by day. While scrolling, the day you're in stays at the top of the screen
 * until the next day pushes it up and takes its place; not while searching, when the results
 * are a short list anyway.
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
  /** What counts towards the totals (0 for anything that didn't really move). */
  amountOf: (t: T) => number;
  direction: 'in' | 'out';
  sticky: boolean;
  /** Each row's element id is this plus its id, so a link can scroll to it. */
  idPrefix?: string;
  children: (t: T) => ReactNode;
}) {
  const sign = direction === 'in' ? '+' : '−';
  return (
    <div className="space-y-3">
      {byMonth(items, dateOf, amountOf).map((m) => (
        <section key={m.key} aria-label={m.label} className="bg-white rounded-3xl border border-gray-100 shadow-card">
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <h3 className="font-display text-[17px] font-extrabold text-ink">{m.label}</h3>
            <p className="text-[13px] text-gray-500 tabular-nums">
              {direction === 'in' ? 'In' : 'Out'} <span className="font-bold text-ink">{formatCurrency(m.total)}</span>
              <span className="text-gray-400"> · {m.count}</span>
            </p>
          </div>
          {m.days.map((day, di) => (
            <div key={day.key} role="group" aria-label={day.label}>
              <div
                className={`${sticky ? 'sticky top-safe z-10' : ''} flex items-baseline justify-between gap-3 px-4 py-1.5 bg-chalk/95 backdrop-blur border-y border-gray-100 text-[12px] font-bold`}
              >
                <span className="text-gray-700">{day.label}</span>
                <span className="text-gray-500 tabular-nums">
                  {sign}
                  {formatCurrency(day.total)}
                </span>
              </div>
              <ul className="divide-y divide-gray-100 text-left">
                {day.items.map((t, i) => (
                  <li
                    key={idOf(t)}
                    id={`${idPrefix}${idOf(t)}`}
                    className={`scroll-mt-24 ${di === m.days.length - 1 && i === day.items.length - 1 ? 'rounded-b-3xl overflow-hidden' : ''}`}
                  >
                    {children(t)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
