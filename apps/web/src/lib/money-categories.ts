import type { MoneyInCategory, PayoutCategory } from './api';

/** Money in that isn't a player's, in the words the organiser sees. */
export const MONEY_IN: Record<MoneyInCategory, { label: string; hint: string }> = {
  organiser: { label: 'My own top-up', hint: 'Money you put in yourself' },
  sponsor: { label: 'Sponsor', hint: 'A sponsor or a gift to the group' },
  refund: { label: 'Refund', hint: 'Money coming back, e.g. from the pitch' },
  other: { label: 'Other', hint: 'Anything else that isn’t a player paying' },
};

/** What a withdrawal was for. */
export const PAYOUT: Record<PayoutCategory, string> = {
  pitch: 'Pitch fee',
  footballs: 'Footballs',
  bibs: 'Bibs',
  water: 'Water',
  supplies: 'Pitch supplies',
  refund: 'Refund to a player',
  other: 'Other',
};

/** Withdrawal categories an organiser can pick (a refund to a player is set by the refund itself). */
export const PAYOUT_PICKS = (Object.keys(PAYOUT) as PayoutCategory[]).filter((k) => k !== 'refund');
