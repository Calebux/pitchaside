'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { kitFor } from '@/components/illustrations';
import { stagger } from '@/components/motion';
import { formatCurrency } from '@/lib/api';

export interface SwitchGroup {
  id: string;
  name: string;
  clubName?: string;
  schedule?: string;
  /** To send now for this group. */
  toPay?: number;
}

/**
 * The player's version of the organiser's group switch, at the top of Home: all their groups, or
 * one. Home, Games and Club follow it; Pay always lists every group so nothing owed is missed.
 * With one group it's just a label; with none it's not there.
 */
export function PlayerGroupSwitch({ groups, value, onPick }: { groups: SwitchGroup[]; value: string | null; onPick: (id: string | null) => void }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;
  const current = groups.find((g) => g.id === value) ?? null;
  // The same name in two clubs: say which club.
  const clubs = new Set(groups.map((g) => g.clubName).filter(Boolean));
  const sub = (g: SwitchGroup) => [clubs.size > 1 ? g.clubName : null, g.schedule].filter(Boolean).join(' · ');

  if (groups.length === 1) {
    return (
      <span className="inline-flex items-center gap-2 max-w-full h-10 pl-1.5 pr-3.5 rounded-full bg-white border border-gray-200 shadow-card">
        <Badge name={groups[0].name} />
        <span className="min-w-0 truncate text-[14px] font-bold text-ink">{groups[0].name}</span>
      </span>
    );
  }

  const options: (SwitchGroup | null)[] = [null, ...groups];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${current?.name ?? 'All my groups'}. Switch group`}
        className="press inline-flex items-center gap-2 max-w-full h-10 pl-1.5 pr-3 rounded-full bg-white border border-gray-200 shadow-card hover:border-ink"
      >
        {current ? <Badge name={current.name} /> : <AllBadge />}
        <span className="min-w-0 truncate text-[14px] font-bold text-ink">{current?.name ?? 'All my groups'}</span>
        <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <Sheet titleId={titleId} onClose={() => setOpen(false)} align="left">
          <SheetTitle id={titleId} title="Your groups" sub="Home, Games and Club follow the one you pick." onClose={() => setOpen(false)} />
          <ul className="mt-4 rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden" role="radiogroup" aria-label="Groups">
            {options.map((g, i) => {
              const on = (g?.id ?? null) === (current?.id ?? null);
              const owes = g?.toPay ?? 0;
              return (
                <li key={g?.id ?? 'all'} className="animate-rise" style={stagger(i, 30, 0)}>
                  <button
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      onPick(g?.id ?? null);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 min-h-16 px-3.5 py-2.5 text-left transition-colors ${on ? 'bg-volt-300/35' : 'hover:bg-chalk'}`}
                  >
                    {g ? <Badge name={g.name} size="lg" /> : <AllBadge size="lg" />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-ink truncate">{g?.name ?? 'All my groups'}</span>
                      <span className="block text-[13px] text-gray-500 truncate">
                        {g ? sub(g) || 'Your games, table and stats here' : `Every game and vote from your ${groups.length} groups`}
                      </span>
                      {owes > 0 && <span className="block text-[12px] font-bold text-kit-600 tabular-nums">{formatCurrency(owes)} to pay</span>}
                    </span>
                    <span
                      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${on ? 'bg-ink text-volt-300' : 'border-2 border-gray-200'}`}
                      aria-hidden
                    >
                      {on && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 px-1 text-[12px] leading-snug text-gray-500">Pay always shows every group, so nothing you owe is missed.</p>
        </Sheet>
      )}
    </>
  );
}

function Badge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const kit = kitFor(name);
  return (
    <span
      className={`${size === 'lg' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-[11px]'} shrink-0 rounded-full ${kit.bg} ${kit.fg} flex items-center justify-center font-extrabold font-display`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** "All my groups": a stack of three little balls instead of one group's letter. */
function AllBadge({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className={`${size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'} shrink-0 rounded-full bg-ink text-volt-300 flex items-center justify-center`} aria-hidden>
      <svg className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="7" cy="8" r="3" />
        <circle cx="17" cy="8" r="3" />
        <circle cx="12" cy="16.5" r="3" />
      </svg>
    </span>
  );
}
