import { existsSync } from 'fs';
import { join } from 'path';
import { bannerFiles, memberInviteEmail, noticeEmail, passwordResetEmail, playerCodeEmail } from './templates';

const assets = 'https://pitchaside.example/email';

describe('email templates', () => {
  it('escapes names and club names that contain HTML', () => {
    const email = memberInviteEmail({
      assets,
      name: '<img src=x onerror=alert(1)>',
      orgName: 'Tunde & Sons <b>FC</b>',
      tempPassword: 'a"b',
      loginUrl: 'https://example.com/signin',
    });
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).not.toContain('onerror=alert(1)>');
    expect(email.html).not.toContain('<b>FC</b>');
    expect(email.html).toContain('Tunde &amp; Sons &lt;b&gt;FC&lt;/b&gt;');
    // Subject and plain text are not HTML, so they keep the original characters.
    expect(email.subject).toBe("You've been added to Tunde & Sons <b>FC</b> on PitchAside");
    expect(email.text).toContain('Temporary password: a"b');
  });

  it('puts the reset link in both the HTML and the plain text', () => {
    const resetUrl = 'https://example.com/reset-password?token=abc';
    const email = passwordResetEmail({ assets, name: 'Ada', resetUrl });
    expect(email.html).toContain(`href="${resetUrl}"`);
    expect(email.text).toContain(resetUrl);
  });

  it('turns a notice into an email with a button that fits its kind', () => {
    const email = noticeEmail({
      assets,
      name: 'Emeka',
      clubName: 'Lekki Ballers',
      kind: 'payment_reminder',
      title: '₦3,000 for last night',
      body: 'Tuesday Night 5s\nYour reference is PA7K2Q.',
      url: 'https://example.com/me/pay',
    });
    expect(email.subject).toBe('₦3,000 for last night');
    expect(email.html).toContain('See how to pay');
    expect(email.html).toContain('Your reference is PA7K2Q.');
    expect(email.html).toContain('you play with Lekki Ballers');
  });

  it("gives each email the app's artwork, animated only for a payment received", () => {
    const banner = (html: string) => html.match(/<img src="([^"]+)"[^>]*alt="([^"]*)"/)!.slice(1);
    const notice = (kind: string) => noticeEmail({ assets: `${assets}/`, name: 'Emeka', clubName: 'Lekki Ballers', kind, title: 'T', body: 'B' }).html;

    expect(banner(notice('receipt'))).toEqual([`${assets}/paid.gif`, '']);
    expect(banner(notice('dues_reminder'))[0]).toBe(`${assets}/kitty.png`);
    expect(banner(notice('rsvp_open'))[0]).toBe(`${assets}/squad.png`);
    expect(banner(notice('reminder_eve'))[0]).toBe(`${assets}/tactics.png`);
    expect(banner(notice('vote_open'))[0]).toBe(`${assets}/trophy.png`);
    expect(banner(notice('something_new'))[0]).toBe(`${assets}/stadium.png`);
    expect(banner(playerCodeEmail({ assets, name: 'Emeka', code: '482913' }).html)[0]).toBe(`${assets}/stadium.png`);
  });

  it.each(bannerFiles)('%s is shipped with the web app', (file) => {
    expect(existsSync(join(__dirname, '..', '..', '..', 'web', 'public', 'email', file))).toBe(true);
  });

  it('leaves the button out when a notice has no link', () => {
    const email = noticeEmail({ assets, name: 'Emeka', clubName: 'Lekki Ballers', kind: 'receipt', title: 'Paid', body: 'Thanks!' });
    expect(email.html).not.toContain('<a href');
  });
});
