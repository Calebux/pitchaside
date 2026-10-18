import { payerNameFrom } from './payer-name';

describe('payerNameFrom', () => {
  it('uses the sender field when the bank fills it', () => {
    expect(payerNameFrom('ADA OBI', 'Transfer from SOMEONE ELSE')).toBe('ADA OBI');
  });

  it('reads the name from the narration when the sender field is empty', () => {
    expect(payerNameFrom(null, 'Transfer from DAVID OREKOYA')).toBe('DAVID OREKOYA');
    expect(payerNameFrom('', 'TRF FROM SEGUN JOHN/0123456789')).toBe('SEGUN JOHN');
    expect(payerNameFrom(undefined, 'Transfer from EZRA ENEZE to SATURDAY BALLERS')).toBe('EZRA ENEZE');
    expect(payerNameFrom('  ', 'transfer from Ugonna Okafor - saturday ball')).toBe('Ugonna Okafor');
  });

  it('gives up when there is no full name to go on', () => {
    expect(payerNameFrom(null, 'saturday ball')).toBeNull();
    expect(payerNameFrom(null, 'Transfer from ADA')).toBeNull();
    expect(payerNameFrom(null, null)).toBeNull();
  });
});
