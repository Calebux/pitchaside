import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
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
      this.transporter = null as any;
    }
  }

  async sendPasswordReset(to: string, name: string, token: string) {
    const resetUrl = `${this.config.get('APP_URL', 'http://localhost:3000')}/reset-password?token=${token}`;

    const subject = 'Reset your PitchAside password';
    const html = `
      <p>Hi ${name},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
      <p>— PitchAside</p>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
      this.logger.log(`[DEV EMAIL] Reset URL: ${resetUrl}`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }

  async sendMemberInvite(to: string, name: string, orgName: string, tempPassword: string) {
    const loginUrl = `${this.config.get('APP_URL', 'http://localhost:3000')}/signin`;

    const subject = `You've been added to ${orgName} on PitchAside`;
    const html = `
      <p>Hi ${name},</p>
      <p>You've been added to <strong>${orgName}</strong> on PitchAside.</p>
      <p>Sign in with your email and this temporary password:</p>
      <p><strong>${tempPassword}</strong></p>
      <p><a href="${loginUrl}">Sign in here</a></p>
      <p>Please change your password after signing in.</p>
      <p>— PitchAside</p>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
      this.logger.log(`[DEV EMAIL] Temp password: ${tempPassword}`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }
}
