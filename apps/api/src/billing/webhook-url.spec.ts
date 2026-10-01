import { webhookUrlsFor } from './webhook-url';

describe('webhookUrlsFor', () => {
  const production = { appUrl: 'https://www.pitchaside.com', railwayDomain: 'pitchaside-api-production.up.railway.app' };

  it("accepts the API's own Railway address — what's set in the Pulse dashboard", () => {
    expect(webhookUrlsFor(production)).toContain('https://pitchaside-api-production.up.railway.app/api/pulse/webhook');
  });

  it('accepts the website address, with and without www', () => {
    const urls = webhookUrlsFor(production);
    expect(urls).toContain('https://www.pitchaside.com/api/pulse/webhook');
    expect(urls).toContain('https://pitchaside.com/api/pulse/webhook');
  });

  it('lists an explicit API_PUBLIC_URL first', () => {
    expect(webhookUrlsFor({ ...production, apiPublicUrl: 'https://api.pitchaside.com/' })[0]).toBe('https://api.pitchaside.com/api/pulse/webhook');
  });

  it('falls back to the live site when nothing is configured', () => {
    expect(webhookUrlsFor({})).toEqual(['https://www.pitchaside.com/api/pulse/webhook', 'https://pitchaside.com/api/pulse/webhook']);
  });

  it('does not invent a www. variant for a Railway domain', () => {
    expect(webhookUrlsFor({ railwayDomain: 'x.up.railway.app' }).some((u) => u.includes('www.x.up'))).toBe(false);
  });
});
