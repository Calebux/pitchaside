import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService, parseSender } from './mail.service';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail })) }));

function service(env: Record<string, string>) {
  const config = { get: (key: string, fallback?: unknown) => env[key] ?? fallback } as unknown as ConfigService;
  return new MailService(config);
}

const fetchMock = jest.fn();

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('parseSender', () => {
  it('splits a display name from the address', () => {
    expect(parseSender('PitchAside <noreply@pitchaside.com>')).toEqual({ name: 'PitchAside', address: 'noreply@pitchaside.com' });
    expect(parseSender('"PitchAside" <noreply@pitchaside.com>')).toEqual({ name: 'PitchAside', address: 'noreply@pitchaside.com' });
    expect(parseSender(' noreply@pitchaside.com ')).toEqual({ address: 'noreply@pitchaside.com' });
  });
});

describe('MailService', () => {
  it('sends through the ZeptoMail API when a token is set, even if SMTP is configured too', async () => {
    const mail = service({
      ZEPTOMAIL_TOKEN: 'secret-token',
      SMTP_HOST: 'smtp.zeptomail.com',
      MAIL_FROM: 'PitchAside <noreply@pitchaside.com>',
      APP_URL: 'https://www.pitchaside.com',
    });
    await mail.sendEmailVerification('ada@example.com', 'Ada', 'tok123');

    expect(mail.mode).toBe('live');
    expect(sendMail).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.zeptomail.com/v1.1/email');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Zoho-enczapikey secret-token');
    const body = JSON.parse(init.body);
    expect(body.from).toEqual({ name: 'PitchAside', address: 'noreply@pitchaside.com' });
    expect(body.to).toEqual([{ email_address: { address: 'ada@example.com' } }]);
    expect(body.subject).toBe('Verify your PitchAside email');
    expect(body.htmlbody).toContain('https://www.pitchaside.com/verify-email?token=tok123');
    expect(body.textbody).toContain('https://www.pitchaside.com/verify-email?token=tok123');
  });

  it('accepts the token pasted with its "Zoho-enczapikey" prefix, and a regional API URL', async () => {
    const mail = service({ ZEPTOMAIL_TOKEN: ' Zoho-enczapikey secret-token ', ZEPTOMAIL_API_URL: 'https://api.zeptomail.eu/v1.1/email' });
    await mail.sendPlayerCode('ada@example.com', 'Ada', '482913');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.zeptomail.eu/v1.1/email');
    expect(init.headers.Authorization).toBe('Zoho-enczapikey secret-token');
  });

  it("turns a ZeptoMail rejection into a message for the user, keeping the provider's reason", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: { code: 'TM_4001', message: 'Access Denied', details: [{ target: 'from', message: 'Sender domain not verified' }] } }),
    });
    const mail = service({ ZEPTOMAIL_TOKEN: 'secret-token' });

    const err = await mail.sendPasswordReset('ada@example.com', 'Ada', 'tok').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toBe("We couldn't send the email just now. Please try again in a minute.");
    expect((err.cause as Error).message).toBe('ZeptoMail 400: TM_4001 — Access Denied — from: Sender domain not verified');
  });

  it('does the same when the provider cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));
    const mail = service({ ZEPTOMAIL_TOKEN: 'secret-token' });

    const err = await mail.sendPlayerCode('ada@example.com', 'Ada', '482913').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err.cause as Error).message).toContain('timeout');
  });

  it('falls back to SMTP when there is no token', async () => {
    const mail = service({ SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'PitchAside <noreply@pitchaside.com>' });
    await mail.sendPlayerCode('ada@example.com', 'Ada', '482913');

    expect(mail.mode).toBe('live');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', from: 'PitchAside <noreply@pitchaside.com>' }));
  });

  it('sends nothing, and says so, when no provider is configured', async () => {
    const mail = service({});
    await expect(mail.sendPlayerCode('ada@example.com', 'Ada', '482913')).resolves.toBeUndefined();

    expect(mail.mode).toBe('mock');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
