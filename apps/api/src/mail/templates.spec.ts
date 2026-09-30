import { memberInviteEmail, noticeEmail, passwordResetEmail } from './templates';

describe('email templates', () => {
  it('escapes names and club names that contain HTML', () => {
    const email = memberInviteEmail({
      name: '<img src=x onerror=alert(1)>',
      orgName: 'Tunde & Sons <b>FC</b>',
      tempPassword: 'a"b',
      loginUrl: 'https://example.com/signin',
    });
    expect(email.html).not.toContain('<img');
    expect(email.html).not.toContain('<b>FC</b>');
    expect(email.html).toContain('Tunde &amp; Sons &lt;b&gt;FC&lt;/b&gt;');
    // Subject and plain text are not HTML, so they keep the original characters.
    expect(email.subject).toBe("You've been added to Tunde & Sons <b>FC</b> on PitchAside");
    expect(email.text).toContain('Temporary password: a"b');
  });

  it('puts the reset link in both the HTML and the plain text', () => {
    const resetUrl = 'https://example.com/reset-password?token=abc';
    const email = passwordResetEmail({ name: 'Ada', resetUrl });
    expect(email.html).toContain(`href="${resetUrl}"`);
    expect(email.text).toContain(resetUrl);
  });

  it('turns a notice into an email with a button that fits its kind', () => {
    const email = noticeEmail({
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

  it('leaves the button out when a notice has no link', () => {
    const email = noticeEmail({ name: 'Emeka', clubName: 'Lekki Ballers', kind: 'receipt', title: 'Paid', body: 'Thanks!' });
    expect(email.html).not.toContain('<a href');
  });
});
