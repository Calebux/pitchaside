export type MoneyView = 'transfers' | 'payouts';

/** Where a group's money lives, for links from anywhere: Home, notifications, a transfer row. */
export function moneyHref(groupId: string, opts: { view?: MoneyView; transfer?: string; unnamed?: boolean } = {}) {
  const q = new URLSearchParams({ group: groupId });
  if (opts.view === 'payouts') q.set('view', 'payouts');
  if (opts.transfer) q.set('transfer', opts.transfer);
  if (opts.unnamed) q.set('show', 'unnamed');
  return `/money?${q}`;
}
