import { periodFor } from './billing.service';
import { PaymentType } from '../groups/entities/group.entity';
import { MockPayrepClient } from './payrep/mock-payrep.client';

describe('periodFor', () => {
  const wed = new Date(2026, 8, 30); // Wed 30 Sep 2026

  it('starts weeks on Monday', () => {
    expect(periodFor(PaymentType.WEEKLY, wed).start).toBe('2026-09-28');
    expect(periodFor(PaymentType.WEEKLY, new Date(2026, 9, 4)).start).toBe('2026-09-28'); // Sunday
  });

  it('uses the 1st of the month', () => {
    expect(periodFor(PaymentType.MONTHLY, wed)).toEqual({ start: '2026-09-01', label: 'September 2026' });
  });

  it('buckets quarters', () => {
    expect(periodFor(PaymentType.QUARTERLY, wed)).toEqual({ start: '2026-07-01', label: 'Q3 2026' });
    expect(periodFor(PaymentType.QUARTERLY, new Date(2026, 9, 1)).label).toBe('Q4 2026');
  });

  it('uses the calendar year for annual dues', () => {
    expect(periodFor(PaymentType.ANNUALLY, wed)).toEqual({ start: '2026-01-01', label: '2026 season' });
  });

  it('has no period for per-game groups', () => {
    expect(() => periodFor(PaymentType.PER_SESSION, wed)).toThrow();
  });
});

describe('MockPayrepClient', () => {
  const client = new MockPayrepClient('secret');

  it('provisions a stable 10-digit account per reference', async () => {
    const a = await client.createAccount({ reference: 'group-1', accountName: 'X' });
    const b = await client.createAccount({ reference: 'group-1', accountName: 'X' });
    expect(a.accountNumber).toMatch(/^\d{10}$/);
    expect(a.accountNumber).toBe(b.accountNumber);
  });

  it('verifies webhook signatures', () => {
    const body = JSON.stringify({ event: 'transfer.received', data: { amount: 5000 } });
    expect(client.verifyWebhook(body, client.sign(body))).toBe(true);
    expect(client.verifyWebhook(body, 'bad')).toBe(false);
    expect(client.verifyWebhook(body + ' ', client.sign(body))).toBe(false);
    expect(client.verifyWebhook(body, undefined)).toBe(false);
  });

  it('ignores non-credit events', () => {
    expect(client.parseWebhook({ event: 'account.created' })).toBeNull();
  });
});
