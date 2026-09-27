'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { http } from '@/lib/http';
import { useToast } from '@/components/toast';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-pitch-700">
            PitchAside
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-500 mb-4">Invalid or missing reset token.</p>
          <Link
            href="/forgot-password"
            className="text-sm text-pitch-600 font-medium hover:text-pitch-700"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
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
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Password reset</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your password has been updated successfully.
          </p>
          <Link
            href="/signin"
            className="inline-block py-2.5 px-6 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await http.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="text-2xl font-bold text-pitch-700">
          PitchAside
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Set new password</h1>
        <p className="mt-1 text-sm text-gray-500">Enter your new password below</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pitch-600" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
