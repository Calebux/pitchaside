import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailContent, memberInviteEmail, noticeEmail, passwordResetEmail, playerCodeEmail, verifyEmailEmail } from './templates';

/**
 * Sends over SMTP — ZeptoMail in production (smtp.zeptomail.com, user
 * "emailapikey"), though any SMTP provider works. With no SMTP_HOST the
 * emails are only logged, which is what dev uses.
 */
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(private config: ConfigService) {
    this.from = config.get('MAIL_FROM', 'PitchAside <noreply@pitchaside.com>');

    const host = config.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('SMTP_PORT', 587),
        secure: config.get('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: config.get('SMTP_USER'),
          pass: config.get('SMTP_PASS'),
        },
      });
    } else {
      // Dev fallback: log emails to console
      this.logger.warn('No SMTP_HOST configured — emails will be logged to console');
      this.transporter = null;
    }
  }

  /** 'mock' = nothing leaves the server (no SMTP configured). */
  get mode(): 'live' | 'mock' {
    return this.transporter ? 'live' : 'mock';
  }

  private async send(to: string, email: EmailContent) {
    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${email.subject}\n${email.text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject: email.subject, html: email.html, text: email.text });
  }

  private appUrl(path: string) {
    return `${this.config.get('APP_URL', 'http://localhost:3000')}${path}`;
  }

  sendPasswordReset(to: string, name: string, token: string) {
    return this.send(to, passwordResetEmail({ name, resetUrl: this.appUrl(`/reset-password?token=${token}`) }));
  }

  sendEmailVerification(to: string, name: string, token: string) {
    return this.send(to, verifyEmailEmail({ name, verifyUrl: this.appUrl(`/verify-email?token=${token}`) }));
  }

  sendMemberInvite(to: string, name: string, orgName: string, tempPassword: string) {
    return this.send(to, memberInviteEmail({ name, orgName, tempPassword, loginUrl: this.appUrl('/signin') }));
  }

  /** The code a player needs to set or reset their password. */
  sendPlayerCode(to: string, name: string, code: string) {
    return this.send(to, playerCodeEmail({ name, code }));
  }

  /** A player notification (receipt, reminder, "who's in?"…) as an email. `path` is a route in the app. */
  sendNotice(to: string, notice: { name: string; clubName: string; kind: string; title: string; body: string; path?: string }) {
    return this.send(to, noticeEmail({ ...notice, url: notice.path ? this.appUrl(notice.path) : undefined }));
  }
}
