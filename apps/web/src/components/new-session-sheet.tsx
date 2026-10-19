'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { btnPrimary } from '@/components/buttons';
import { useToast } from '@/components/toast';
import { prettyTime } from '@/components/player-ui';
import { DAYS, Select, Stepper, TIMES, chip, field, label } from '@/components/group/group-edit-sheet';
import { createSession, type IGroupWithMembers } from '@/lib/api';

const REPEATS = [
  { value: 'none', label: 'Just this one' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const short = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

/** The next three dates on the group's game day (from today), or the next three days if it has none. */
function nextGameDays(group?: IGroupWithMembers) {
  // "Every Saturday", "Saturdays", "Saturday mornings": the first weekday it names.
  const said = (group?.schedule ?? '').toLowerCase();
  const want = DAYS.findIndex((d) => said.includes(d.toLowerCase())); // Monday = 0
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; out.length < 3 && i < 21; i++) {
    const c = new Date(d);
    c.setDate(d.getDate() + i);
    if (want < 0 ? i > 0 : (c.getDay() + 6) % 7 === want) out.push(c);
  }
  return out;
}

/**
 * Schedule a game (or a run of them) without opening the group first: tap the group, tap the next
 * game day, kick-off is the group's usual time. Another date or a repeat is one more tap.
 */
export function NewSessionSheet({ groups, onClose }: { groups: IGroupWithMembers[]; onClose: () => void }) {
  const titleId = useId();
  const router = useRouter();
  const toast = useToast();
  const [groupId, setGroupId] = useState(groups.length === 1 ? groups[0].id : '');
  const group = groups.find((g) => g.id === groupId);
  const options = nextGameDays(group);
  const [date, setDate] = useState(() => (groups.length === 1 ? iso(nextGameDays(groups[0])[0]) : ''));
  const [otherDate, setOtherDate] = useState(false);
  // Starts at the group's usual kick-off; players are told it and reminded 2 hours before.
  const [time, setTime] = useState(groups.length === 1 ? (groups[0].kickoffTime ?? '').slice(0, 5) : '');
  const [repeat, setRepeat] = useState('none');
  const [count, setCount] = useState(4);
  const [creating, setCreating] = useState(false);
  const repeating = repeat !== 'none';
  const times = time && !TIMES.includes(time) ? [time, ...TIMES] : TIMES;

  function pickGroup(id: string) {
    const g = groups.find((x) => x.id === id);
    setGroupId(id);
    setTime((g?.kickoffTime ?? '').slice(0, 5));
    setDate(iso(nextGameDays(g)[0]));
    setOtherDate(false);
  }

  async function create() {
    if (!groupId || !date) return;
    setCreating(true);
    try {
      const session = await createSession({
        groupId,
        date,
        kickoffTime: time || undefined,
        recurrenceType: repeating ? repeat : undefined,
        recurrenceCount: repeating ? count : undefined,
      });
      toast.success(repeating ? `${count} games scheduled` : 'Game scheduled');
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The game wasn’t scheduled. Try again.');
      setCreating(false);
    }
  }

  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      align="left"
      footer={
        <button onClick={create} disabled={!groupId || !date || creating} className={`${btnPrimary} w-full disabled:opacity-40`}>
          {creating ? 'Scheduling…' : repeating ? `Schedule ${count} games` : 'Schedule game'}
        </button>
      }
    >
      <SheetTitle
        id={titleId}
        title="New game"
        sub={
          !group
            ? 'Pick the group, then the day.'
            : group.requireRsvp
              ? 'Players say they’re in from the game link, and pay once they’ve played.'
              : 'Everyone in the group is on it and pays once they’ve played.'
        }
        onClose={onClose}
      />

      <div className="mt-5 space-y-5">
        {groups.length > 1 && (
          <fieldset>
            <legend className={label}>Group</legend>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button key={g.id} type="button" aria-pressed={groupId === g.id} onClick={() => pickGroup(g.id)} className={chip(groupId === g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {group && (
          <>
            <fieldset>
              <legend className={label}>Day</legend>
              <div className="flex flex-wrap gap-2">
                {options.map((d) => (
                  <button
                    key={iso(d)}
                    type="button"
                    aria-pressed={!otherDate && date === iso(d)}
                    onClick={() => {
                      setOtherDate(false);
                      setDate(iso(d));
                    }}
                    className={chip(!otherDate && date === iso(d))}
                  >
                    {short(d)}
                  </button>
                ))}
                <button type="button" aria-pressed={otherDate} onClick={() => setOtherDate(true)} className={chip(otherDate)}>
                  Another day
                </button>
              </div>
              {otherDate && (
                <input
                  type="date"
                  aria-label="Game date"
                  value={date}
                  min={iso(new Date())}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${field} mt-2`}
                />
              )}
            </fieldset>

            <div>
              <label htmlFor={`${titleId}-time`} className={label}>
                Kick-off
              </label>
              <Select id={`${titleId}-time`} value={time} onChange={setTime}>
                <option value="">Not set</option>
                {times.map((t) => (
                  <option key={t} value={t}>
                    {prettyTime(t)}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-gray-500">Players get the time now, and a reminder 2 hours before.</p>
            </div>

            <fieldset>
              <legend className={label}>Repeat</legend>
              <div className="flex flex-wrap gap-2">
                {REPEATS.map((r) => (
                  <button key={r.value} type="button" aria-pressed={repeat === r.value} onClick={() => setRepeat(r.value)} className={chip(repeat === r.value)}>
                    {r.label}
                  </button>
                ))}
              </div>
              {repeating && (
                <div className="mt-3">
                  <span id={`${titleId}-count`} className={label}>
                    How many games
                  </span>
                  <Stepper id={`${titleId}-count-input`} labelledBy={`${titleId}-count`} value={count} onChange={(v) => setCount(Math.min(52, v))} step={1} min={2} less="One fewer game" more="One more game" />
                </div>
              )}
            </fieldset>
          </>
        )}
      </div>
    </Sheet>
  );
}
