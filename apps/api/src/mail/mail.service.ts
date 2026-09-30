import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailContent, memberInviteEmail, noticeEmail, passwordResetEmail, playerCodeEmail, verifyEmailEmail } from './templates';

/** How long to wait on the mail provider before giving up — a request must never hang on it. */
const SEND_TIMEOUT_MS = 15_000;

/** "PitchAside <noreply@pitchaside.com>" → its two parts. */
export function parseSender(from: string): { name?: string; address: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (!match) return { address: from.trim() };
  const name = match[1].replace(/^"|"$/g, '');
  return name ? { name, address: match[2] } : { address: match[2] };
}

/**
 * Sends email one of three ways, chosen from the environment:
 *
 * - ZEPTOMAIL_TOKEN set → ZeptoMail's HTTPS API. This is what production uses:
 *   Railway blocks outgoing SMTP (ports 25/465/587) on every plan below Pro, so
 *   SMTP there never connects.
 * - otherwise SMTP_HOST set → SMTP (any provider; fine where the port is open).
 * - neither → nothing is sent; emails are logged, which is what dev uses.
 *
 * A failure is logged with the provider's reason, then thrown as a 503 with a
 * sentence fit to show the user.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly zeptoToken: string | null;
  private readonly zeptoUrl: string;

  constructor(private config: ConfigService) {
    this.from = config.get('MAIL_FROM', 'PitchAside <noreply@pitchaside.com>');

    // The dashboard shows the token with its "Zoho-enczapikey " prefix; accept it pasted either way.
    const token = config.get<string>('ZEPTOMAIL_TOKEN', '').trim().replace(/^zoho-enczapikey\s+/i, '');
    this.zeptoToken = token || null;
    this.zeptoUrl = config.get('ZEPTOMAIL_API_URL', 'https://api.zeptomail.com/v1.1/email');

    const host = config.get('SMTP_HOST');
    if (this.zeptoToken) {
      this.logger.log(`Sending email through the ZeptoMail API as ${this.from}`);
    } else if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('SMTP_PORT', 587),
        secure: config.get('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: config.get('SMTP_USER'),
          pass: config.get('SMTP_PASS'),
        },
        connectionTimeout: SEND_TIMEOUT_MS,
        greetingTimeout: SEND_TIMEOUT_MS,
        socketTimeout: SEND_TIMEOUT_MS,
      });
      this.logger.log(`Sending email over SMTP (${host}) as ${this.from}`);
    } else {
      this.logger.warn('No ZEPTOMAIL_TOKEN or SMTP_HOST configured — emails are NOT sent, only logged');
    }
  }

  /** 'mock' = nothing leaves the server (no mail provider configured). */
  get mode(): 'live' | 'mock' {
    return this.zeptoToken || this.transporter ? 'live' : 'mock';
  }

  private async send(to: string, email: EmailContent) {
    if (this.mode === 'mock') {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${email.subject}\n${email.text}`);
      return;
    }
    try {
      if (this.zeptoToken) await this.sendViaZeptoMail(to, email);
      else await this.transporter!.sendMail({ from: this.from, to, subject: email.subject, html: email.html, text: email.text });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email "${email.subject}" to ${to} failed: ${reason}`);
      // What the person sees; the provider's reason stays in the log and on `cause`.
      throw new ServiceUnavailableException("We couldn't send the email just now. Please try again in a minute.", { cause: err });
    }
  }

  private async sendViaZeptoMail(to: string, email: EmailContent) {
    const res = await fetch(this.zeptoUrl, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-enczapikey ${this.zeptoToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: parseSender(this.from),
        to: [{ email_address: { address: to } }],
        subject: email.subject,
        htmlbody: email.html,
        textbody: email.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (res.ok) return;

    // ZeptoMail explains rejections in the body (unverified sender domain, bad token, account under review…).
    const body = await res.text().catch(() => '');
    let reason = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { code?: string; message?: string; details?: { message?: string; target?: string }[] } };
      const detail = parsed.error?.details?.map((d) => [d.target, d.message].filter(Boolean).join(': ')).join('; ');
      reason = [parsed.error?.code, parsed.error?.message, detail].filter(Boolean).join(' — ') || reason;
    } catch {
      /* not JSON — keep the raw text */
    }
    throw new Error(`ZeptoMail ${res.status}: ${reason || 'no explanation given'}`);
  }

  /** Banner images live in the web app's public/email folder. */
  private get assets() {
    return this.appUrl('/email');
  }

  private appUrl(path: string) {
    return `${this.config.get('APP_URL', 'http://localhost:3000')}${path}`;
  }

  sendPasswordReset(to: string, name: string, token: string) {
    return this.send(to, passwordResetEmail({ assets: this.assets, name, resetUrl: this.appUrl(`/reset-password?token=${token}`) }));
  }

  sendEmailVerification(to: string, name: string, token: string) {
    return this.send(to, verifyEmailEmail({ assets: this.assets, name, verifyUrl: this.appUrl(`/verify-email?token=${token}`) }));
  }

  sendMemberInvite(to: string, name: string, orgName: string, tempPassword: string) {
    return this.send(to, memberInviteEmail({ assets: this.assets, name, orgName, tempPassword, loginUrl: this.appUrl('/signin') }));
  }

  /** The code a player needs to set or reset their password. */
  sendPlayerCode(to: string, name: string, code: string) {
    return this.send(to, playerCodeEmail({ assets: this.assets, name, code }));
  }

  /** A player notification (receipt, reminder, "who's in?"…) as an email. `path` is a route in the app. */
  sendNotice(to: string, notice: { name: string; clubName: string; kind: string; title: string; body: string; path?: string }) {
    return this.send(to, noticeEmail({ ...notice, assets: this.assets, url: notice.path ? this.appUrl(notice.path) : undefined }));
  }
}
