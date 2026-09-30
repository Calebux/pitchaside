import { createHmac } from 'crypto';
import { HttpPulseClient } from './http-pulse.client';
import { accountNameFor } from '../billing.service';

const fetchMock = jest.fn();

const client = new HttpPulseClient({
  baseUrl: 'https://pulse.example.test',
  publicKey: 'pk_test',
  privateKey: 'sk_test',
  webhookSecret: 'whsec_test',
});

function created() {
  return {
    ok: true,
    status: 201,
    json: async () => ({
      statusCode: 201,
      message: 'Prefix account created successfully',
      data: { account_number: '9995734440', account_name: "CAL'/'PitchAside Lekki Ballers", reference: 'group-1' },
    }),
  };
}

/** What the account-creation call answers; the prefix lookup before it always succeeds. */
let accountResponse: unknown;
const prefixes = { ok: true, status: 200, json: async () => ({ data: [{ _id: 'pfx-1', account_number: '1008618754', status: 'active' }] }) };

/** The createAccount request itself (a prefix lookup may come first). */
const accountCall = () => fetchMock.mock.calls.find(([url]) => String(url).endsWith('/accounts/prefix'))!;

beforeEach(() => {
  accountResponse = created();
  fetchMock.mockReset().mockImplementation(async (url: string) => (url.endsWith('/accounts/prefixes') ? prefixes : accountResponse));
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('HttpPulseClient.createAccount', () => {
  it('signs the request the way the PulseMFB Postman collection does', async () => {
    const account = await client.createAccount({ reference: 'group-1', accountName: 'PitchAside Lekki Ballers', email: 'ada@example.com', phone: '08055940326' });

    const [url, init] = accountCall();
    expect(url).toBe('https://pulse.example.test/api/v1/external-api/accounts/prefix');
    expect(init.method).toBe('POST');
    const h = init.headers;
    expect(h['x-public-key']).toBe('pk_test');
    // timestamp + method + path + body, HMAC-SHA256 with the private key, hex.
    const payload = h['x-timestamp'] + 'POST' + '/api/v1/external-api/accounts/prefix' + init.body;
    expect(h['x-signature']).toBe(createHmac('sha256', 'sk_test').update(payload).digest('hex'));

    expect(JSON.parse(init.body)).toEqual({
      customer_name: 'PitchAside Lekki Ballers',
      customer_phone: '08055940326',
      customer_email: 'ada@example.com',
      sweep_mode: 'manual',
      use_prefix: true,
      prefix_id: 'pfx-1',
      reference: 'group-1',
    });
    expect(account).toEqual({
      accountNumber: '9995734440',
      accountName: "CAL'/'PitchAside Lekki Ballers",
      bankName: 'Payrep Microfinance Bank',
      providerReference: 'group-1',
    });
  });

  it.each(['https://pulse.example.test/api/v1/external-api', 'https://pulse.example.test/api/v1/external-api/', 'https://pulse.example.test/'])(
    'does not double the API prefix when PULSE_BASE_URL is %p',
    async (baseUrl) => {
      const c = new HttpPulseClient({ baseUrl, publicKey: 'pk_test', privateKey: 'sk_test', webhookSecret: 'whsec_test' });
      await c.createAccount({ reference: 'group-1', accountName: 'X' });

      expect(accountCall()[0]).toBe('https://pulse.example.test/api/v1/external-api/accounts/prefix');
    },
  );

  it('leaves out contact details it does not have instead of sending empty strings', async () => {
    await client.createAccount({ reference: 'group-1', accountName: 'PitchAside Lekki Ballers' });

    expect(JSON.parse(accountCall()[1].body)).toEqual({
      customer_name: 'PitchAside Lekki Ballers',
      sweep_mode: 'manual',
      use_prefix: true,
      prefix_id: 'pfx-1',
      reference: 'group-1',
    });
  });

  it("passes on Pulse's validation reason", async () => {
    accountResponse = {
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ statusCode: 400, message: 'Validation failed', error: 'Bad Request', details: [{ field: 'bvn', message: 'bvn is required' }] }),
    };

    await expect(client.createAccount({ reference: 'group-1', accountName: 'X' })).rejects.toThrow(
      'Payrep MFB createAccount failed (400): Validation failed — bvn: bvn is required',
    );
  });

  it('passes on a plain-text failure as is', async () => {
    accountResponse = { ok: false, status: 502, text: async () => 'Bad gateway' };

    await expect(client.createAccount({ reference: 'group-1', accountName: 'X' })).rejects.toThrow(
      'Payrep MFB createAccount failed (502): Bad gateway',
    );
  });
});

describe('accountNameFor', () => {
  it('keeps names bank systems accept', () => {
    expect(accountNameFor('Lekki Ballers')).toBe('PitchAside Lekki Ballers');
    expect(accountNameFor("St. Mary's 5-a-side")).toBe("PitchAside St. Mary's 5-a-side");
  });

  it('drops dashes, emoji and accents that could get the request rejected', () => {
    expect(accountNameFor('Tuesday – Night ⚽ Fútbol')).toBe('PitchAside Tuesday Night Futbol');
  });

  it('fits in 60 characters', () => {
    expect(accountNameFor('x'.repeat(100))).toHaveLength(60);
  });
});

describe('HttpPulseClient webhooks', () => {
  const sign = (body: string) => createHmac('sha256', 'whsec_test').update(body).digest('hex');

  it('accepts a signature over the raw body', () => {
    const raw = '{"event":"transfer.completed","data":{"amount":1500}}';
    expect(client.verifyWebhook(raw, sign(raw))).toBe(true);
  });

  it("accepts a signature over JSON.stringify(body), the way Pulse's docs sign it", () => {
    const raw = '{\n  "event": "transfer.completed",\n  "data": { "amount": 1500 }\n}';
    expect(client.verifyWebhook(raw, sign(JSON.stringify(JSON.parse(raw))))).toBe(true);
  });

  it('rejects a wrong or missing signature', () => {
    const raw = '{"event":"transfer.completed"}';
    expect(client.verifyWebhook(raw, sign('something else'))).toBe(false);
    expect(client.verifyWebhook(raw, undefined)).toBe(false);
  });

  it('reads the documented transfer.completed payload as a credit', () => {
    const credit = client.parseWebhook({
      event: 'transfer.completed',
      timestamp: '2026-09-30T19:20:00Z',
      data: { reference: 'FT123', amount: 1500, debit_account: '0123456789', credit_account: '9999268301', status: 'completed', narration: 'PA8GHYE' },
    });
    expect(credit).toMatchObject({ providerTransactionId: 'FT123', accountNumber: '9999268301', amount: 1500, narration: 'PA8GHYE' });
  });

  it('reads a credit under another event name and field names', () => {
    const credit = client.parseWebhook({
      event: 'account.credited',
      data: { transaction_reference: 'NIP-9', amount: '2000', account_number: '9999268301', sender_name: 'ADA OBI', description: 'dues' },
    });
    expect(credit).toMatchObject({ providerTransactionId: 'NIP-9', accountNumber: '9999268301', amount: 2000, senderName: 'ADA OBI', narration: 'dues' });
  });

  it('ignores failed transfers, VAS events and account creation', () => {
    expect(client.parseWebhook({ event: 'transfer.failed', data: { reference: 'x', amount: 5, credit_account: '1' } })).toBeNull();
    expect(client.parseWebhook({ event: 'transfer.completed', data: { reference: 'x', amount: 5, credit_account: '1', status: 'failed' } })).toBeNull();
    expect(client.parseWebhook({ event: 'vas.completed', data: { reference: 'x', amount: 5, account_number: '1' } })).toBeNull();
    expect(client.parseWebhook({ event: 'account.created', data: { account_number: '1' } })).toBeNull();
  });
});

describe('HttpPulseClient.getBalance', () => {
  it("returns the account's available balance", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { account_number: '9999268301', available_balance: 1500, ledger_balance: 1500, currency: 'NGN' } }),
    });
    await expect(client.getBalance('9999268301')).resolves.toBe(1500);
    expect(fetchMock.mock.calls[0][0]).toBe('https://pulse.example.test/api/v1/external-api/accounts/9999268301/balance');
  });
});
