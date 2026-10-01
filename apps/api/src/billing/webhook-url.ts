const WEBHOOK_PATH = '/api/pulse/webhook';

export function normaliseWebhookUrl(url: string) {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url.trim();
  }
}

/**
 * Every address Pulse may send webhooks to that reaches this API: the website (it proxies /api,
 * with and without "www.") and the API's own public domain (Railway sets RAILWAY_PUBLIC_DOMAIN;
 * API_PUBLIC_URL overrides it). Pointing Pulse straight at the API is fine — it skips a hop.
 */
export function webhookUrlsFor(env: { appUrl?: string; apiPublicUrl?: string; railwayDomain?: string }): string[] {
  const hosts: string[] = [];
  const add = (origin?: string) => {
    if (!origin?.trim()) return;
    try {
      const u = new URL(/^https?:\/\//.test(origin) ? origin : `https://${origin}`);
      hosts.push(`${u.protocol}//${u.host.toLowerCase()}`);
    } catch {
      /* not a URL — skip it */
    }
  };
  add(env.apiPublicUrl);
  add(env.railwayDomain);
  add(env.appUrl || 'https://www.pitchaside.com');
  // www.example.com and example.com reach the same site.
  for (const h of [...hosts]) {
    const m = h.match(/^(https?:\/\/)(www\.)?(.+)$/);
    if (m && !/railway\.app$|localhost|\d+\.\d+\.\d+\.\d+/.test(m[3])) hosts.push(m[2] ? `${m[1]}${m[3]}` : `${m[1]}www.${m[3]}`);
  }
  return [...new Set(hosts)].map((h) => `${h}${WEBHOOK_PATH}`);
}
