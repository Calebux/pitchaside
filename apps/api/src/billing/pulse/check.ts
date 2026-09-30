/**
 * Checks the PulseMFB setup with the real keys: where Pulse sends webhooks, and
 * optionally a group account's balance. Run it with the production env, e.g.
 *
 *   railway run npm run pulse:check --workspace=apps/api
 *   railway run npm run pulse:check --workspace=apps/api -- 9999268301      # + that account's balance
 *   railway run npm run pulse:check --workspace=apps/api -- --test           # + ask Pulse to send a test webhook
 *
 * It only reads, except --test, which asks Pulse to send one "webhook.test" event.
 * Changing the webhook URL is left to Pulse's dashboard on purpose: it issues a new
 * webhook secret, which then has to go into PULSE_WEBHOOK_SECRET.
 */
import { createHmac } from 'crypto';
import { pulseReason } from './http-pulse.client';

const base = (process.env.PULSE_BASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/api\/v1\/external-api$/, '');
const publicKey = process.env.PULSE_PUBLIC_KEY ?? '';
const privateKey = process.env.PULSE_PRIVATE_KEY ?? '';
const expectedUrl = `${(process.env.APP_URL || 'https://www.pitchaside.com').replace(/\/+$/, '')}/api/pulse/webhook`;

async function call(method: 'GET' | 'POST', path: string) {
  const timestamp = Date.now().toString();
  const signature = createHmac('sha256', privateKey).update(timestamp + method + path).digest('hex');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-public-key': publicKey, 'x-signature': signature, 'x-timestamp': timestamp },
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await pulseReason(res)}`);
  const json = (await res.json()) as { data?: Record<string, unknown> };
  return json.data ?? {};
}

async function main() {
  if (!base || !publicKey || !privateKey) throw new Error('Set PULSE_BASE_URL, PULSE_PUBLIC_KEY and PULSE_PRIVATE_KEY');
  const args = process.argv.slice(2);

  const hooks = await call('GET', '/api/v1/external-api/webhooks');
  const url = String(hooks.webhook_url ?? '');
  const events = (hooks.events as string[] | undefined) ?? [];
  console.log(`Webhook URL at Pulse: ${url || '(none)'}`);
  console.log(`Events:              ${events.join(', ') || '(none)'}`);
  console.log(`Secret ends with:    ${String(hooks.webhook_secret ?? '').slice(-4) || '(none)'}   ours ends with: ${(process.env.PULSE_WEBHOOK_SECRET ?? '').slice(-4) || '(unset)'}`);
  if (url !== expectedUrl) console.log(`\n✗ Pulse should send webhooks to ${expectedUrl}`);
  if (!events.some((e) => e.startsWith('transfer'))) console.log('✗ Pulse is not sending transfer events');

  const account = args.find((a) => /^\d{10}$/.test(a));
  if (account) {
    const bal = await call('GET', `/api/v1/external-api/accounts/${account}/balance`);
    console.log(`\nBalance of ${account}: ₦${bal.available_balance} (ledger ₦${bal.ledger_balance})`);
  }

  if (args.includes('--test')) {
    const sent = await call('POST', '/api/v1/external-api/webhooks/test');
    console.log(`\nTest webhook: ${sent.status ?? 'sent'} to ${sent.webhook_url ?? url} — look for "Pulse webhook webhook.test" in the API logs.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
