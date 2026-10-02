export interface NigerianBank {
  code: string;
  name: string;
}

/**
 * Bank codes from Pulse MFB's supported institution list.
 * Commercial banks use 6-digit CBN codes; MFBs/fintechs use their CBN codes.
 * Pulse also auto-maps 3-digit NIP codes for major commercial banks, but we
 * use the canonical 6-digit codes throughout for consistency.
 */
export const NIGERIAN_BANKS: NigerianBank[] = [
  // Commercial banks
  { code: '000014', name: 'Access Bank' },
  { code: '000005', name: 'Access Bank (Diamond)' },
  { code: '000037', name: 'Alternative Bank' },
  { code: '000009', name: 'Citibank Nigeria' },
  { code: '000010', name: 'Ecobank Nigeria' },
  { code: '000007', name: 'Fidelity Bank' },
  { code: '000016', name: 'First Bank of Nigeria' },
  { code: '000003', name: 'First City Monument Bank' },
  { code: '000027', name: 'Globus Bank' },
  { code: '000013', name: 'Guaranty Trust Bank' },
  { code: '000020', name: 'Heritage Bank' },
  { code: '000006', name: 'Jaiz Bank' },
  { code: '000002', name: 'Keystone Bank' },
  { code: '000029', name: 'Lotus Bank' },
  { code: '000036', name: 'Optimus Bank' },
  { code: '000030', name: 'Parallex Bank' },
  { code: '000008', name: 'Polaris Bank' },
  { code: '000031', name: 'Premium Trust Bank' },
  { code: '000023', name: 'Providus Bank' },
  { code: '000034', name: 'Signature Bank' },
  { code: '000012', name: 'Stanbic IBTC Bank' },
  { code: '000021', name: 'Standard Chartered Bank' },
  { code: '000001', name: 'Sterling Bank' },
  { code: '000022', name: 'Suntrust Bank' },
  { code: '000026', name: 'TAJ Bank' },
  { code: '000025', name: 'Titan Trust Bank' },
  { code: '000018', name: 'Union Bank of Nigeria' },
  { code: '000004', name: 'United Bank for Africa' },
  { code: '000011', name: 'Unity Bank' },
  { code: '000017', name: 'Wema Bank' },
  { code: '000015', name: 'Zenith Bank' },
  // Digital banks / microfinance
  { code: '100026', name: 'Carbon' },
  { code: '090328', name: 'Eyowo' },
  { code: '090551', name: 'Fairmoney Microfinance Bank' },
  { code: '090267', name: 'Kuda Microfinance Bank' },
  { code: '090405', name: 'Moniepoint Microfinance Bank' },
  { code: '100004', name: 'OPay' },
  { code: '100002', name: 'Paga' },
  { code: '100033', name: 'PalmPay' },
  { code: '090198', name: 'RenMoney Microfinance Bank' },
  { code: '090175', name: 'Rubies Microfinance Bank' },
  { code: '090325', name: 'Sparkle' },
  { code: '090146', name: 'Trident Microfinance Bank' },
  { code: '090110', name: 'VFD Microfinance Bank' },
];
