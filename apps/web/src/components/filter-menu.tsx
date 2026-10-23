'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';

type BarCtx = { open: string | null; setOpen: (id: string | null) => void };
const Bar = createContext<BarCtx | null>(null);

/**
 * A row of filter buttons ("All categories ▾", "All status ▾") whose choices drop down as a
 * panel of chips under the row, like a bank app's transaction filters. One panel at a time;
 * the page under it dims, and a tap outside, Escape or picking a choice closes it.
 */
export function FilterBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <Bar.Provider value={{ open, setOpen }}>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 animate-fade-in" aria-hidden />}
      {/* Lifted over the page only while a panel is open, so it never covers a sticky bar above it */}
      <div ref={ref} className={`relative ${open ? 'z-40' : ''} flex items-center gap-2 ${className}`}>
        {children}
      </div>
    </Bar.Provider>
  );
}

export type FilterOption<T extends string> = { value: T; label: string };

/**
 * One filter in a FilterBar. Shows what's picked (or a bare icon, for sort), and drops its
 * choices as chips under the bar. `value` equal to the first option reads as "not filtered".
 */
export function FilterMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
  title,
  columns = 3,
  custom,
}: {
  /** What the button is about, for screen readers: "Category", "Sort players". */
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Show only this icon on the button (it fills dark while a choice other than the first is on). */
  icon?: ReactNode;
  /** A line over the chips, e.g. "Sort by". */
  title?: string;
  columns?: 2 | 3;
  /**
   * A choice that needs more than a tap (e.g. "Pick dates"): tapping it keeps the panel open
   * and shows `render` under the chips; call `done` once it's applied to close the panel.
   */
  custom?: { value: T; render: (done: () => void) => ReactNode };
}) {
  const bar = useContext(Bar);
  const id = useId();
  const open = bar?.open === id;
  const [picking, setPicking] = useState(false);
  // Each time the panel opens, the custom part shows only if that's what's already picked.
  useEffect(() => {
    if (open) setPicking(!!custom && value === custom.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== options[0].value;

  return (
    <>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={icon ? `${label}: ${current.label}` : undefined}
        onClick={() => bar?.setOpen(open ? null : id)}
        className={
          icon
            ? `press shrink-0 w-11 h-11 rounded-2xl border flex items-center justify-center transition-colors ${
                open ? 'bg-volt-300 border-volt-300 text-ink' : active ? 'bg-ink border-ink text-volt-300' : 'bg-white border-gray-200 text-ink hover:border-ink'
              }`
            : `press flex-1 min-w-0 min-h-11 px-3.5 rounded-2xl border inline-flex items-center justify-between gap-2 text-[14px] font-bold transition-colors ${
                open ? 'bg-volt-300/40 border-pitch-600 text-ink' : active ? 'bg-ink border-ink text-volt-300' : 'bg-white border-gray-200 text-ink hover:border-ink'
              }`
        }
      >
        {icon ?? (
          <>
            <span className="truncate">{current.label}</span>
            <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M2 4h8L6 9z" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          className="absolute left-0 right-0 top-full mt-2 rounded-3xl bg-white shadow-lift border border-gray-100 p-3 animate-fade-in-up"
        >
          {title && <p className="px-1 pb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-500">{title}</p>}
          <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {options.map((o) => {
              const on = custom && picking ? o.value === custom.value : o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    if (custom && o.value === custom.value) return setPicking(true);
                    onChange(o.value);
                    bar?.setOpen(null);
                  }}
                  className={`press min-h-12 px-2 rounded-2xl text-[13px] font-bold leading-tight transition-colors ${
                    on ? 'bg-volt-300 text-ink' : 'bg-chalk text-ink hover:bg-gray-200'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {custom && picking && <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in-up">{custom.render(() => bar?.setOpen(null))}</div>}
        </div>
      )}
    </>
  );
}
