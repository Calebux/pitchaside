import { PaymentType } from '../groups/entities/group.entity';

/** Groups that collect dues per period rather than per game. */
export const PERIODIC_TYPES = [
  PaymentType.WEEKLY,
  PaymentType.MONTHLY,
  PaymentType.QUARTERLY,
  PaymentType.ANNUALLY,
];

export function isPeriodic(type: PaymentType | string) {
  return PERIODIC_TYPES.includes(type as PaymentType);
}

export interface BillingPeriod {
  /** ISO date (YYYY-MM-DD) of the first day of the period. */
  start: string;
  label: string;
}

export function periodFor(type: PaymentType, now = new Date()): BillingPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (type) {
    case PaymentType.WEEKLY: {
      const start = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7));
      return {
        start: iso(start),
        label: `Week of ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      };
    }
    case PaymentType.MONTHLY: {
      const start = new Date(y, m, 1);
      return { start: iso(start), label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
    }
    case PaymentType.QUARTERLY: {
      const q = Math.floor(m / 3);
      return { start: iso(new Date(y, q * 3, 1)), label: `Q${q + 1} ${y}` };
    }
    case PaymentType.ANNUALLY:
      return { start: iso(new Date(y, 0, 1)), label: `${y} season` };
    default:
      throw new Error(`No billing period for payment type ${type}`);
  }
}

/** The dues period a game on `date` (YYYY-MM-DD) falls in. Midday, so no time zone shifts the day. */
export function periodOfGame(type: PaymentType, date: string) {
  return periodFor(type, new Date(`${date.slice(0, 10)}T12:00:00`));
}
