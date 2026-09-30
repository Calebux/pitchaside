import { clientAddress } from './rate-limit';

describe('clientAddress', () => {
  it("uses the visitor's address Vercel passes on, not the proxy's", () => {
    expect(
      clientAddress({
        ip: '10.0.0.5',
        headers: { 'x-vercel-forwarded-for': '102.89.23.4', 'x-forwarded-for': '102.89.23.4, 76.76.21.9' },
      }),
    ).toBe('102.89.23.4');
  });

  it('falls back to the first x-forwarded-for entry', () => {
    expect(clientAddress({ ip: '10.0.0.5', headers: { 'x-forwarded-for': ' 197.210.8.1 , 76.76.21.9' } })).toBe('197.210.8.1');
    expect(clientAddress({ ip: '10.0.0.5', headers: { 'x-forwarded-for': ['2c0f:f5c0::1', '76.76.21.9'] } })).toBe('2c0f:f5c0::1');
  });

  it('uses the socket address when nothing was forwarded (local development)', () => {
    expect(clientAddress({ ip: '::1', headers: {} })).toBe('::1');
  });

  it('ignores forwarding headers that are not addresses', () => {
    expect(clientAddress({ ip: '10.0.0.5', headers: { 'x-forwarded-for': 'not-an-ip' } })).toBe('10.0.0.5');
    expect(clientAddress({ ip: '10.0.0.5', headers: { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '197.210.8.1' } })).toBe('197.210.8.1');
  });
});
