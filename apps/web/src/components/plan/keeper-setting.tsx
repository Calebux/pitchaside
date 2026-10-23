'use client';

import { useId, useState } from 'react';
import type { KeeperPref } from '@pitchaside/shared';
import { setMyKeeper } from '@/lib/player';
import { useToast } from '@/components/toast';
import { BallSpinner } from '@/components/skeleton';

const OPTIONS: { value: KeeperPref; label: string; sub: string }[] = [
  { value: 'happy', label: 'Happy in goal', sub: 'You take more turns in goal' },
  { value: null, label: 'Don’t mind', sub: 'You take your turn like everyone' },
  { value: 'rather_not', label: 'Rather not', sub: 'Only when nobody else can' },
];

/**
 * Whether they want to go in goal when a match day plan swaps players round. Saved straight away,
 * for every club they play in.
 */
export function KeeperSetting({ value, onSaved }: { value: KeeperPref | undefined; onSaved?: () => void }) {
  const id = useId();
  const toast = useToast();
  const [current, setCurrent] = useState<KeeperPref>(value ?? null);
  const [saving, setSaving] = useState<KeeperPref | undefined>(undefined);

  async function pick(next: KeeperPref) {
    if (next === current || saving !== undefined) return;
    const before = current;
    setCurrent(next);
    setSaving(next);
    try {
      await setMyKeeper(next);
      onSaved?.();
      toast.success(next === 'happy' ? 'Saved: happy in goal' : next === 'rather_not' ? 'Saved: rather not go in goal' : 'Saved: you don’t mind going in goal');
    } catch (err) {
      setCurrent(before);
      toast.error(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    } finally {
      setSaving(undefined);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-4">
      <p id={id} className="text-[15px] font-bold text-ink">
        <span aria-hidden>🧤 </span>Going in goal
      </p>
      <p className="text-[13px] leading-snug text-gray-600">When the organiser plans the day, the swaps use this.</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby={id}>
        {OPTIONS.map((o) => {
          const on = current === o.value;
          return (
            <button
              key={o.label}
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.value)}
              className={`press min-h-16 px-2 py-2 rounded-2xl border text-center transition-colors ${
                on ? 'bg-ink border-ink text-white' : 'bg-white border-gray-200 text-ink hover:border-ink'
              }`}
            >
              <span className="flex items-center justify-center gap-1 text-[13px] font-bold leading-tight">
                {saving === o.value && <BallSpinner className="w-3.5 h-3.5" />}
                {o.label}
              </span>
              <span className={`block mt-0.5 text-[11px] leading-tight ${on ? 'text-white/70' : 'text-gray-500'}`}>{o.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
