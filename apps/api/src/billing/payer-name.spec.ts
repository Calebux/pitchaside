import { payerNameFrom, whoSent } from './payer-name';

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

describe('whoSent', () => {
  const squad = [
    { playerId: 'ada', paymentRef: 'PA7K3FQ', firstName: 'Ada', lastName: 'Obi' },
    { playerId: 'bisi', paymentRef: 'PAJD7CY', firstName: 'Bisi', lastName: 'Lawal' },
    { playerId: 'bisi2', paymentRef: null, firstName: 'Bisi', lastName: 'Lawal-Ade' },
  ];

  it('goes by the payment code first, whatever the name says', () => {
    expect(whoSent(squad, 'Bisi Lawal', 'pa-7k3fq football')).toBe('ada');
  });

  it('goes by the sender field, then by the name in the narration', () => {
    expect(whoSent(squad, 'ADA OBI', null)).toBe('ada');
    expect(whoSent(squad, '', 'Transfer from ADA OBI to PitchAside')).toBe('ada');
  });

  it('leaves it to a person when the name fits no one or more than one', () => {
    expect(whoSent(squad, '', 'Transfer from MUM')).toBeNull();
    expect(whoSent(squad, 'Bisi Lawal Ade', null)).toBeNull();
  });
});
