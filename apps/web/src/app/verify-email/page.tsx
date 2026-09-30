'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/brand';
import { Confetti } from '@/components/confetti';
import { Celebration, OffsideFlag } from '@/components/illustrations';
import { BallLoader } from '@/components/skeleton';
import { useAuth } from '@/lib/auth';

/*
 * Lives outside the (auth) group on purpose: that layout sends signed-in people
 * to the dashboard before the page renders, so the link never got verified for
 * anyone who was already signed in.
 */

type Status = 'loading' | 'success' | 'error';

function VerifyEmail() {
  const token = useSearchParams().get('token');
  const { user, loading, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  // The token only works once, so ask exactly once (Strict Mode runs effects twice in dev).
  const asked = useRef(false);

  useEffect(() => {
    if (loading || asked.current) return;
    asked.current = true;

    if (!token) {
      setStatus(user?.emailVerified ? 'success' : 'error');
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .then(async (ok) => {
        // Update the signed-in account before they head back, or the app would still ask them to verify.
        if (ok && user) await refreshUser();
        // An already-verified account opening an old link is still a success.
        setStatus(ok || user?.emailVerified ? 'success' : 'error');
      });
  }, [loading, token, user, refreshUser]);

  if (status === 'loading') {
    return (
      <div className="mt-10">
        <BallLoader label="Checking your link…" />
      </div>
    );
  }

  const next = user ? { href: '/dashboard', label: 'Go to dashboard' } : { href: '/signin', label: 'Sign in' };

  if (status === 'success') {
    return (
      <>
        <Confetti />
        <Celebration className="w-52 h-auto mx-auto mt-6 animate-float" />
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold text-ink">Congratulations!</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your email is verified. Your club&apos;s account is safe and you&apos;re all set.
        </p>
        <Link
          href={next.href}
          className="mt-6 inline-block w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors text-center"
        >
          {next.label}
        </Link>
      </>
    );
  }

  return (
    <>
      <OffsideFlag className="w-48 h-40 mx-auto mt-6" />
      <h1 className="mt-2 text-[28px] leading-tight font-extrabold text-ink">That link didn&apos;t work</h1>
      <p className="mt-2 text-sm text-gray-500">
        It may have expired, or a newer email replaced it. {user ? 'Send a fresh one from Settings.' : 'Sign in to get a fresh one.'}
      </p>
      <Link
        href={user ? '/settings' : '/signin'}
        className="mt-6 inline-block w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors text-center"
      >
        {user ? 'Go to Settings' : 'Sign in'}
      </Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5 py-12 relative">
      <div className="absolute inset-0 chalk-dots opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] pointer-events-none" />
      <div className="relative w-full max-w-sm text-center animate-fade-in-up">
        <Logo />
        <Suspense fallback={<div className="mt-10"><BallLoader /></div>}>
          <VerifyEmail />
        </Suspense>
      </div>
    </div>
  );
}
