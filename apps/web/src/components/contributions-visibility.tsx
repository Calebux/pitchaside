'use client';

import type { ContributionsVisibility } from '@pitchaside/shared';

const OPTIONS: { value: ContributionsVisibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only organisers see the kitty' },
  { value: 'totals', label: 'Totals', hint: 'Amount collected and how many paid' },
  { value: 'names', label: 'Totals + names', hint: 'Players see who has paid' },
];

/** "What players can see" of the group's contributions. Used on create and edit group forms. */
export function ContributionsVisibilityPicker({
  value,
  onChange,
  name,
}: {
  value?: ContributionsVisibility;
  onChange?: (v: ContributionsVisibility) => void;
  /** Set for uncontrolled use inside a <form>. */
  name?: string;
}) {
  return (
    <fieldset>
      <legend className="block text-xs font-bold text-gray-700 mb-1.5">What players can see of contributions</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name ?? 'contributionsVisibility'}
              value={o.value}
              {...(onChange
                ? { checked: (value ?? 'private') === o.value, onChange: () => onChange(o.value) }
                : { defaultChecked: (value ?? 'private') === o.value })}
              className="peer sr-only"
            />
            <span className="flex flex-col h-full px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white transition-colors peer-checked:border-ink peer-checked:bg-volt-300 peer-focus-visible:ring-4 peer-focus-visible:ring-volt-300/70 hover:border-gray-300">
              <span className="text-sm font-bold text-ink">{o.label}</span>
              <span className="text-[11px] text-gray-500 leading-tight mt-0.5">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
