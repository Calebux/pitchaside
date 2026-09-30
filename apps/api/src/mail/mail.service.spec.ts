import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

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

describe('MailService', () => {
  it('sends through the Resend API when a key is set, even if SMTP is configured too', async () => {
    const mail = service({
      RESEND_API_KEY: 're_test-key',
      SMTP_HOST: 'smtp.example.com',
      MAIL_FROM: 'PitchAside <hi@pitchaside.com>',
      APP_URL: 'https://www.pitchaside.com',
    });
    await mail.sendEmailVerification('ada@example.com', 'Ada', 'tok123');

    expect(mail.mode).toBe('live');
    expect(sendMail).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_test-key');
    const body = JSON.parse(init.body);
    expect(body.from).toBe('PitchAside <hi@pitchaside.com>');
    expect(body.to).toEqual(['ada@example.com']);
    expect(body.subject).toBe('Verify your PitchAside email');
    expect(body.html).toContain('https://www.pitchaside.com/verify-email?token=tok123');
    expect(body.text).toContain('https://www.pitchaside.com/verify-email?token=tok123');
  });

  it('uses a custom Resend API URL when configured', async () => {
    const mail = service({ RESEND_API_KEY: 're_test-key', RESEND_API_URL: 'https://resend.example.test/emails' });
    await mail.sendPlayerCode('ada@example.com', 'Ada', '482913');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://resend.example.test/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test-key');
  });

  it('turns a Resend rejection into a message for the user, keeping the provider reason', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ name: 'validation_error', message: 'The sender domain is not verified' }),
    });
    const mail = service({ RESEND_API_KEY: 're_test-key' });

    const err = await mail.sendPasswordReset('ada@example.com', 'Ada', 'tok').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toBe("We couldn't send the email just now. Please try again in a minute.");
    expect((err.cause as Error).message).toBe('Resend 403: validation_error — The sender domain is not verified');
  });

  it('does the same when the provider cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));
    const mail = service({ RESEND_API_KEY: 're_test-key' });

    const err = await mail.sendPlayerCode('ada@example.com', 'Ada', '482913').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err.cause as Error).message).toContain('timeout');
  });

  it('falls back to SMTP when there is no Resend key', async () => {
    const mail = service({ SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'PitchAside <hi@pitchaside.com>' });
    await mail.sendPlayerCode('ada@example.com', 'Ada', '482913');

    expect(mail.mode).toBe('live');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', from: 'PitchAside <hi@pitchaside.com>' }));
  });

  it('sends nothing, and says so, when no provider is configured', async () => {
    const mail = service({});
    await expect(mail.sendPlayerCode('ada@example.com', 'Ada', '482913')).resolves.toBeUndefined();

    expect(mail.mode).toBe('mock');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([undefined, 'http://localhost:3000', 'http://127.0.0.1:3000/'])(
    'links real email to the live site, not localhost, when APP_URL is %p',
    async (appUrl) => {
      const mail = service({ RESEND_API_KEY: 're_test-key', ...(appUrl ? { APP_URL: appUrl } : {}) });
      await mail.sendEmailVerification('ada@example.com', 'Ada', 'tok123');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain('https://www.pitchaside.com/verify-email?token=tok123');
      expect(body.html).toContain('src="https://www.pitchaside.com/email/');
      expect(body.html).not.toContain('localhost');
    },
  );

  it('keeps a real APP_URL as is, without a trailing slash', async () => {
    const mail = service({ RESEND_API_KEY: 're_test-key', APP_URL: 'https://staging.pitchaside.com/' });
    await mail.sendEmailVerification('ada@example.com', 'Ada', 'tok123');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.html).toContain('https://staging.pitchaside.com/verify-email?token=tok123');
  });
});
