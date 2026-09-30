'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then((res) => {
        setStatus(res.ok ? 'success' : 'error');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="w-full max-w-sm text-center">
      <Logo />

      {status === 'loading' && (
        <>
          <h1 className="mt-6 text-[28px] leading-tight font-extrabold text-ink">Verifying...</h1>
          <p className="mt-2 text-sm text-gray-500">Please wait while we verify your email.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <h1 className="mt-6 text-[28px] leading-tight font-extrabold text-ink">Email Verified</h1>
          <p className="mt-2 text-sm text-gray-500">Your email has been verified successfully.</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors text-center"
          >
            Go to Dashboard
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="mt-6 text-[28px] leading-tight font-extrabold text-ink">Verification Failed</h1>
          <p className="mt-2 text-sm text-gray-500">
            This link is invalid or has expired. Please request a new verification email from your dashboard.
          </p>
          <Link
            href="/signin"
            className="mt-6 inline-block w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors text-center"
          >
            Sign In
          </Link>
        </>
      )}
    </div>
  );
}
