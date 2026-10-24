/**
 * A number as WhatsApp and SMS gateways want it: digits with the country code. Numbers stay as
 * people typed them; this is how they're read when sending. Nigerian numbers in any shape
 * ("0803 123 4567", "803 123 4567", "+234 0803…") read "2348031234567"; a number written with
 * its own + code keeps it; anything else is null (better no message than one to a wrong number).
 */
export function dialNumber(phone?: string | null): string | null {
  const raw = (phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('2340') && digits.length === 14) return `234${digits.slice(4)}`;
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `234${digits}`;
  if (raw.startsWith('+') && digits.length >= 8) return digits;
  if (digits.startsWith('00') && digits.length >= 10) return digits.slice(2);
  return null;
}

/** Last 10 digits, so "0803 123 4567" and "+234 803 123 4567" match. */
export function phoneKey(phone: string) {
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * A person's identity across clubs: their email address, trimmed and
 * lower-cased. (Stored in columns still named `phone_key` from when people
 * signed in with a phone number.)
 */
export function emailKey(email: string) {
  return email.trim().toLowerCase();
}

export function naira(amount: number | string) {
  return `₦${Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function shortDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
