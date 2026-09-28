/** Last 10 digits, so "0803 123 4567" and "+234 803 123 4567" match. */
export function phoneKey(phone: string) {
  return phone.replace(/\D/g, '').slice(-10);
}

export function naira(amount: number | string) {
  return `₦${Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function shortDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
