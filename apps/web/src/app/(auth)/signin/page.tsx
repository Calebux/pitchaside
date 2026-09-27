'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';

export default function SignInPage() {
  const router = useRouter();
  const { login, validate2FA } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [twoFA, setTwoFA] = useState<{ required: boolean; userId: string }>({ required: false, userId: '' });
  const [code, setCode] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await login(form.email, form.password);
      if (result.requires2FA) {
        setTwoFA({ required: true, userId: result.userId });
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await validate2FA(twoFA.userId, code);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Invalid 2FA code');
    } finally {
      setSubmitting(false);
    }
  }

  if (twoFA.required) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-pitch-700">
            PitchAside
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Two-Factor Authentication</h1>
          <p className="mt-1 text-sm text-gray-500">Enter the 6-digit code from your authenticator app</p>
        </div>

        <form onSubmit={handle2FASubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Authentication Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              placeholder="000000"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full py-2.5 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => { setTwoFA({ required: false, userId: '' }); setCode(''); }}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="text-2xl font-bold text-pitch-700">
          PitchAside
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-pitch-600 font-medium hover:text-pitch-700"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-pitch-600 font-medium hover:text-pitch-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}
