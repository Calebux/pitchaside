/**
 * Renders every email PitchAside sends, with made-up people, into
 * apps/api/mail-samples/ — one .html per email plus index.html with all of
 * them on one page (print that to PDF for a provider's account review).
 *
 *   npm run mail:samples
 *   APP_URL=https://your-domain npm run mail:samples   # links point at your real domain
 *   MAIL_ASSETS_URL=https://your-domain/email npm run mail:samples   # banner images from the live site
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EmailContent, escapeHtml, memberInviteEmail, noticeEmail, passwordResetEmail, playerCodeEmail, verifyEmailEmail } from './templates';

const appUrl = process.env.APP_URL && !process.env.APP_URL.includes('localhost') ? process.env.APP_URL : 'https://pitchaside.com';
const from = process.env.MAIL_FROM || 'PitchAside <noreply@pitchaside.com>';
// Banner images. By default the local files, so the samples show the artwork even before it is
// deployed; set MAIL_ASSETS_URL (e.g. https://your-domain/email) to link to the live copies instead.
const assets = process.env.MAIL_ASSETS_URL || `file://${join(__dirname, '..', '..', '..', 'web', 'public', 'email')}`;
const club = 'Lekki Ballers';

const samples: { file: string; name: string; when: string; email: EmailContent }[] = [
  {
    file: '1-password-reset',
    name: 'Password reset',
    when: 'An organiser taps "Forgot password" on the sign-in page.',
    email: passwordResetEmail({ assets, name: 'Tunde', resetUrl: `${appUrl}/reset-password?token=3f9a1c7e5b2d48a6` }),
  },
  {
    file: '2-co-organiser-invite',
    name: 'Co-organiser invite',
    when: 'A club admin adds a co-organiser or treasurer to their club.',
    email: memberInviteEmail({ assets, name: 'Ngozi', orgName: club, tempPassword: 'kickoff-4821', loginUrl: `${appUrl}/signin` }),
  },
  {
    file: '3-verify-email',
    name: 'Email verification',
    when: 'An organiser creates their account.',
    email: verifyEmailEmail({ assets, name: 'Tunde', verifyUrl: `${appUrl}/verify-email?token=9c1e44b07a2f4d13` }),
  },
  {
    file: '4-player-password-code',
    name: 'Player password code',
    when: 'A player asks to set their first password or reset a forgotten one on the sign-in page.',
    email: playerCodeEmail({ assets, name: 'Emeka', code: '482913' }),
  },
  {
    file: '5-payment-receipt',
    name: 'Payment receipt',
    when: "A player's payment is recorded — marked paid by the organiser, or matched from their bank transfer.",
    email: noticeEmail({
      assets,
      name: 'Emeka',
      clubName: club,
      kind: 'receipt',
      title: 'We got your ₦3,000 ✅',
      body: 'Tuesday Night 5s — the Tue, 6 Oct game is paid. Thanks!',
      url: `${appUrl}/me`,
    }),
  },
  {
    file: '6-dues-open',
    name: 'Dues open',
    when: 'A new billing period starts for a group the player belongs to (weekly, monthly, quarterly or yearly dues).',
    email: noticeEmail({
      assets,
      name: 'Bisi',
      clubName: club,
      kind: 'dues_open',
      title: 'Friday Floodlights: October 2026 dues are open',
      body: '₦5,000 — tap for the account details and your reference.',
      url: `${appUrl}/me`,
    }),
  },
  {
    file: '7-payment-reminder',
    name: 'Payment reminder',
    when: 'The morning after a game the player played in and has not paid for. Sent once per game.',
    email: noticeEmail({
      assets,
      name: 'Amaka',
      clubName: club,
      kind: 'payment_reminder',
      title: '₦3,000 for last night 🙏',
      body: 'Tuesday Night 5s — tap for the account details. Your reference is PA7K2Q.',
      url: `${appUrl}/me/pay`,
    }),
  },
  {
    file: '8-game-reminder',
    name: 'Game reminder',
    when: "6pm the day before a game the player is in the squad for.",
    email: noticeEmail({
      assets,
      name: 'Seyi',
      clubName: club,
      kind: 'reminder_eve',
      title: 'Tomorrow: Tuesday Night 5s ⚽',
      body: "8pm. You're in — 9/10 confirmed.",
      url: `${appUrl}/me`,
    }),
  },
  {
    file: '9-whos-in',
    name: "Who's in?",
    when: 'An organiser schedules a game for a group where players confirm their place.',
    email: noticeEmail({
      assets,
      name: 'Kola',
      clubName: club,
      kind: 'rsvp_open',
      title: "Who's in? Sunday Morning Kickabout",
      body: 'Sun, 11 Oct · 12 spots. Tap to confirm.',
      url: `${appUrl}/me`,
    }),
  },
];

const outDir = join(__dirname, '..', '..', 'mail-samples');
mkdirSync(outDir, { recursive: true });

for (const s of samples) {
  writeFileSync(join(outDir, `${s.file}.html`), s.email.html);
  writeFileSync(join(outDir, `${s.file}.txt`), `Subject: ${s.email.subject}\n\n${s.email.text}\n`);
}

/** Just the email's own markup, so several can sit on one page. */
const bodyOf = (html: string) => html.slice(html.indexOf('<body') , html.lastIndexOf('</body>')).replace(/^<body[^>]*>/, '');

const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PitchAside — sample emails</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f1a14; }
  .cover, .meta { max-width: 640px; margin: 0 auto; padding: 28px 24px 16px; }
  .cover h1 { font-size: 26px; margin: 0 0 10px; }
  .cover p, .cover li { font-size: 14px; line-height: 1.55; }
  .meta { border-top: 1px solid #e2dfd3; }
  .meta h2 { font-size: 18px; margin: 0 0 8px; }
  .meta dl { margin: 0; display: grid; grid-template-columns: 90px 1fr; gap: 4px 12px; font-size: 13px; }
  .meta dt { color: #767365; }
  .meta dd { margin: 0; }
  .sample { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<div class="cover">
  <h1>PitchAside — sample emails</h1>
  <p>PitchAside is a web app for 5-a-side football groups: organisers schedule games and track who has paid; players confirm they're playing and pay their share.</p>
  <p>We only send transactional email. Every message below is triggered by something the recipient, or the organiser of a club they belong to, has just done. We send no marketing, newsletters or bulk campaigns, and we do not buy or import address lists.</p>
  <ul>
    <li><strong>Organisers</strong> give us their email address when they create their account.</li>
    <li><strong>Players</strong> give us theirs when they sign up through their club's invite link, or their organiser enters it when adding them to the squad.</li>
  </ul>
  <p>Sent from: ${escapeHtml(from)}</p>
</div>
${samples
  .map(
    (s, i) => `<div class="sample">
<div class="meta">
  <h2>${i + 1}. ${escapeHtml(s.name)}</h2>
  <dl>
    <dt>Subject</dt><dd>${escapeHtml(s.email.subject)}</dd>
    <dt>Sent when</dt><dd>${escapeHtml(s.when)}</dd>
  </dl>
</div>
${bodyOf(s.email.html)}
</div>`,
  )
  .join('\n')}
</body>
</html>`;

writeFileSync(join(outDir, 'index.html'), index);
console.log(`Wrote ${samples.length} sample emails to ${outDir}`);
