'use client';

import { useState } from 'react';
import { BallSpinner } from '@/components/skeleton';
import { loginWithPassword, requestCode, resetPassword, setFirstPassword } from '@/lib/player';

type Step = 'login' | 'create' | 'forgot' | 'reset';

const input =
  'w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  required = true,
  hint,
}: {
  required?: boolean;
  hint?: string;
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required={required}
          minLength={required ? 6 : undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} pr-16`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-bold text-gray-500 hover:text-ink"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Phone + password sign-in for players, including first-time password
 * creation (for players added before passwords) and "Forgot password".
 */
export function PasswordSignIn({
  title = 'Sign in',
  subtitle = 'Use your phone number and password.',
  cta = 'Sign in',
  onSignedIn,
  footer,
  initialPhone = '',
}: {
  /** Pre-fill, e.g. when sign-up found the number already has an account. */
  initialPhone?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  onSignedIn: (token: string, firstName: string) => void | Promise<void>;
  footer?: React.ReactNode;
}) {
  const [step, setStep] = useState<Step>('login');
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await loginWithPassword(phone.trim(), password);
      if ('needsPassword' in res) {
        setName(res.firstName);
        setPassword('');
        setStep('create');
        return;
      }
      await onSignedIn(res.token, res.firstName);
    });
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match");
    run(async () => {
      const res = await setFirstPassword(phone.trim(), password);
      await onSignedIn(res.token, res.firstName);
    });
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(async () => {
      const res = await requestCode(phone.trim());
      setDevCode(res.devCode);
      setPassword('');
      setStep('reset');
    });
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await resetPassword(phone.trim(), code, password);
      await onSignedIn(res.token, res.firstName);
    });
  };

  const heading =
    step === 'create' ? `Welcome, ${name}!` : step === 'forgot' || step === 'reset' ? 'Reset your password' : title;
  const sub =
    step === 'create'
      ? 'Your organiser already added you. Create a password to secure your account.'
      : step === 'forgot'
        ? 'We’ll send a 6-digit code to your phone.'
        : step === 'reset'
          ? `Enter the code sent to ${phone} and choose a new password.`
          : subtitle;

  const button = (label: string, disabled = false) => (
    <button
      type="submit"
      disabled={busy || disabled}
      className="w-full py-3.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {busy && <BallSpinner />}
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-3xl border-2 border-ink shadow-sticker p-5 space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink">{heading}</h2>
        <p className="text-sm text-gray-500 mt-1">{sub}</p>
      </div>

      {error && <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}

      {step === 'login' && (
        <form onSubmit={login} className="space-y-3">
          <div>
            <label htmlFor="si-phone" className="block text-xs font-bold text-gray-700 mb-1.5">
              Phone number
            </label>
            <input
              id="si-phone"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={input}
              placeholder="0803 123 4567"
            />
          </div>
          <PasswordField
            id="si-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required={false}
            hint="First time signing in? Leave it blank — we’ll ask you to create one."
          />
          {button(cta, phone.replace(/\D/g, '').length < 10)}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('forgot');
            }}
            className="w-full text-xs font-semibold text-gray-500 hover:text-ink"
          >
            Forgot password?
          </button>
        </form>
      )}

      {step === 'create' && (
        <form onSubmit={create} className="space-y-3">
          <PasswordField id="cp-new" label="New password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
          <PasswordField id="cp-confirm" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {button('Create password & continue', password.length < 6)}
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={sendCode} className="space-y-3">
          <input
            type="tel"
            required
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
            placeholder="0803 123 4567"
            aria-label="Phone number"
          />
          {button('Send code', phone.replace(/\D/g, '').length < 10)}
          <button type="button" onClick={() => setStep('login')} className="w-full text-xs font-semibold text-gray-500 hover:text-ink">
            Back to sign in
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={reset} className="space-y-3">
          {devCode && (
            <p className="text-xs rounded-xl bg-sky-300/30 border border-dashed border-sky-300 px-3 py-2 text-ink">
              Test mode — no message was sent. Your code is <span className="font-mono font-bold">{devCode}</span>
            </p>
          )}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${input} text-center text-2xl tracking-[0.5em] font-mono`}
            placeholder="••••••"
            aria-label="6-digit code"
          />
          <PasswordField id="rp-new" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
          {button('Reset password & sign in', code.length !== 6 || password.length < 6)}
          <button type="button" onClick={() => sendCode()} disabled={busy} className="w-full text-xs font-semibold text-pitch-600">
            Resend code
          </button>
        </form>
      )}

      {footer}
    </div>
  );
}

export { PasswordField };
