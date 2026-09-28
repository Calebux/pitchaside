'use client';

import { useEffect, useRef, useState } from 'react';
import { BallSpinner } from '@/components/skeleton';
import { getAuthMode, requestCode, signInWithPhone, verifyCode } from '@/lib/player';

export interface VerifiedPhone {
  phone: string;
  phoneProof: string;
  token?: string;
  player?: { id: string; firstName: string };
}

/**
 * Two-step phone sign-in: number → 6-digit code from WhatsApp/SMS.
 * Used by /me/login, the group join link and the vote link.
 */
export function PhoneSignIn({
  groupCode,
  title = 'Confirm your number',
  subtitle,
  cta,
  onVerified,
}: {
  groupCode?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  onVerified: (v: VerifiedPhone) => void;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [mode, setMode] = useState<'phone' | 'otp'>('phone');
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAuthMode()
      .then((m) => setMode(m.mode))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === 'phone') {
      try {
        const res = await signInWithPhone(phone.trim(), groupCode);
        onVerified({ phone: phone.trim(), ...res });
      } catch (err: any) {
        setError(err.message);
        setBusy(false);
      }
      return;
    }
    try {
      const res = await requestCode(phone.trim(), groupCode);
      setDevCode(res.devCode);
      setStep('code');
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await verifyCode(phone.trim(), code);
      onVerified({ phone: phone.trim(), ...res });
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  const input =
    'w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

  return (
    <div className="bg-white rounded-3xl border-2 border-ink shadow-sticker p-5 space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink">{step === 'phone' ? title : 'Enter your code'}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {step === 'phone' ? (subtitle ?? (mode === 'phone' ? 'Use the number your organiser has for you.' : 'We’ll send a 6-digit code to your WhatsApp.')) : <>Sent to <span className="font-bold text-ink">{phone}</span>. It expires in 10 minutes.</>}
        </p>
      </div>

      {error && <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}

      {step === 'phone' ? (
        <form onSubmit={send} className="space-y-3">
          <input
            type="tel"
            required
            autoFocus
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
            placeholder="0803 123 4567"
            aria-label="Phone number"
          />
          <button
            type="submit"
            disabled={busy || phone.replace(/\D/g, '').length < 10}
            className="w-full py-3.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <BallSpinner />}
            {cta ?? (mode === 'phone' ? 'Continue' : 'Send my code')}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          {devCode && (
            <p className="text-xs rounded-xl bg-sky-300/30 border border-dashed border-sky-300 px-3 py-2 text-ink">
              Test mode — no message was sent. Your code is <span className="font-mono font-bold">{devCode}</span>
            </p>
          )}
          <input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${input} text-center text-2xl tracking-[0.5em] font-mono`}
            placeholder="••••••"
            aria-label="6-digit code"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full py-3.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <BallSpinner />}
            Confirm
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(null); }} className="font-semibold text-gray-500 hover:text-ink">
              Change number
            </button>
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => send()} className="font-semibold text-pitch-600 hover:text-pitch-800 disabled:text-gray-400">
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
