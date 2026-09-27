'use client';

import Link from 'next/link';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useToast } from '@/components/toast';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await http.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-pitch-700">
            PitchAside
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-4">
            If an account exists with that email, we&apos;ve sent a password reset link.
          </p>
          <Link
            href="/signin"
            className="text-sm text-pitch-600 font-medium hover:text-pitch-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="text-2xl font-bold text-pitch-700">
          PitchAside
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Forgot password?</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Remember your password?{' '}
        <Link href="/signin" className="text-pitch-600 font-medium hover:text-pitch-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
