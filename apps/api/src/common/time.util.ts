/**
 * Small time-zone helpers (no extra dependency). Reminders are scheduled in the
 * organisation's local time — APP_TIMEZONE, default Africa/Lagos.
 */

export const APP_TZ = process.env.APP_TIMEZONE || 'Africa/Lagos';

/** Minutes the zone is ahead of UTC at `at`. */
function offsetMinutes(at: Date, tz: string) {
  const local = new Date(at.toLocaleString('en-US', { timeZone: tz }));
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((local.getTime() - utc.getTime()) / 60000);
}

/** The instant of `YYYY-MM-DD` + `HH:mm` on the wall clock in `tz`. */
export function zonedInstant(dateIso: string, hhmm: string, tz = APP_TZ): Date {
  const [y, m, d] = dateIso.slice(0, 10).split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  return new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
}

/** Today's date (YYYY-MM-DD) in `tz`, shifted by `days`. */
export function localDate(days = 0, tz = APP_TZ, now = new Date()): string {
  const shifted = new Date(now.getTime() + days * 86_400_000);
  return shifted.toLocaleDateString('en-CA', { timeZone: tz });
}

/** "8pm" / "7:30pm" from "20:00" / "19:30". */
export function prettyTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}
