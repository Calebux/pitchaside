'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary } from '@/components/buttons';
import { BallSpinner } from '@/components/skeleton';
import { Select, TIMES, field, label } from '@/components/group/group-edit-sheet';
import { prettyTime } from '@/components/player-ui';
import { updateSession, type ISessionWithDetails } from '@/lib/api';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Move a game before it starts: its day and kick-off time. Venue, price and the player limit
 * belong to the group, so they're changed in the group's settings, not here.
 */
export function EditGameSheet({
  session,
  onSaved,
  onClose,
}: {
  session: ISessionWithDetails;
  onSaved: (s: ISessionWithDetails) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const usual = session.group?.kickoffTime?.slice(0, 5) ?? '';
  const [date, setDate] = useState(String(session.date).slice(0, 10));
  // "" means the group's usual kick-off.
  const [time, setTime] = useState(session.kickoffTime?.slice(0, 5) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = date !== String(session.date).slice(0, 10) || time !== (session.kickoffTime?.slice(0, 5) ?? '');
  const times = time && !TIMES.includes(time) ? [time, ...TIMES] : TIMES;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateSession(session.id, { date, kickoffTime: time }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The game wasn’t moved. Try again.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        <button onClick={save} disabled={!changed || saving || !date} className={`${btnPrimary} w-full`}>
          {saving && <BallSpinner />}
          {saving ? 'Moving…' : 'Move the game'}
        </button>
      }
    >
      <SheetTitle id={titleId} title="Change day or time" sub="Players in the game get a notification (if they’ve turned them on), and reminders go for the new time." onClose={onClose} />
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={`${titleId}-day`} className={label}>
            Day
          </label>
          <input id={`${titleId}-day`} type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor={`${titleId}-time`} className={label}>
            Kick-off
          </label>
          <Select id={`${titleId}-time`} value={time} onChange={setTime}>
            <option value="">{usual ? `Group’s usual (${prettyTime(usual)})` : 'Not set'}</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {prettyTime(t)}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-gray-500">The pitch, price and number of players come from the group’s settings.</p>
        {error && (
          <p role="alert" className="text-sm text-kit-600">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
