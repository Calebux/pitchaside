import { PaymentType } from '@pitchaside/shared';

export const frequencyOptions: { value: PaymentType; label: string; short: string; hint: string }[] = [
  { value: PaymentType.PER_SESSION, label: 'Per game', short: 'per game', hint: 'Pay each time you play' },
  { value: PaymentType.WEEKLY, label: 'Weekly', short: 'per week', hint: 'Dues every Monday' },
  { value: PaymentType.MONTHLY, label: 'Monthly', short: 'per month', hint: 'Dues on the 1st' },
  { value: PaymentType.QUARTERLY, label: 'Quarterly', short: 'per quarter', hint: 'Every 3 months' },
  { value: PaymentType.ANNUALLY, label: 'Annually', short: 'per year', hint: 'One season fee' },
];

export function frequencyLabel(type: PaymentType | string) {
  return frequencyOptions.find((o) => o.value === type)?.label ?? String(type).replace('_', ' ');
}

export function frequencyShort(type: PaymentType | string) {
  return frequencyOptions.find((o) => o.value === type)?.short ?? '';
}

/** Group account numbers read better in 3-3-4 blocks: 866 109 0336. */
export function formatAccountNumber(n: string) {
  return n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : n;
}

export function paymentShareText(opts: {
  groupName: string;
  amount: string;
  frequency: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  link: string;
}) {
  return [
    `⚽ ${opts.groupName} — ${opts.amount} ${opts.frequency}`,
    ``,
    `Pay into:`,
    `${opts.bankName}`,
    `${opts.accountNumber}`,
    `${opts.accountName}`,
    ``,
    `Join the group & get your payment reference: ${opts.link}`,
  ].join('\n');
}
