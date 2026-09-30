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

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(created());
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('HttpPulseClient.createAccount', () => {
  it('signs the request the way the PulseMFB Postman collection does', async () => {
    const account = await client.createAccount({ reference: 'group-1', accountName: 'PitchAside Lekki Ballers', email: 'ada@example.com', phone: '08055940326' });

    const [url, init] = fetchMock.mock.calls[0];
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
      reference: 'group-1',
    });
    expect(account).toEqual({
      accountNumber: '9995734440',
      accountName: "CAL'/'PitchAside Lekki Ballers",
      bankName: 'Pulse Microfinance Bank',
      providerReference: 'group-1',
    });
  });

  it('leaves out contact details it does not have instead of sending empty strings', async () => {
    await client.createAccount({ reference: 'group-1', accountName: 'PitchAside Lekki Ballers' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ customer_name: 'PitchAside Lekki Ballers', reference: 'group-1' });
  });

  it("passes on Pulse's validation reason", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ statusCode: 400, message: 'Validation failed', error: 'Bad Request', details: [{ field: 'bvn', message: 'bvn is required' }] }),
    });

    await expect(client.createAccount({ reference: 'group-1', accountName: 'X' })).rejects.toThrow(
      'PulseMFB createAccount failed (400): Validation failed — bvn: bvn is required',
    );
  });

  it('passes on a plain-text failure as is', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => 'Bad gateway' });

    await expect(client.createAccount({ reference: 'group-1', accountName: 'X' })).rejects.toThrow(
      'PulseMFB createAccount failed (502): Bad gateway',
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
