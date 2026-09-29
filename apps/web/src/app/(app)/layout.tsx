'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth';
import { resendVerification } from '@/lib/api';
import { BallLoader } from '@/components/skeleton';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BallLoader />
      </div>
    );
  }

  if (!user) return null;

  async function handleResend() {
    setResending(true);
    try {
      await resendVerification();
      setResent(true);
    } catch {
      // Silently fail
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      {user && !user.emailVerified && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between md:pl-60">
          <span>Please verify your email address to secure your account.</span>
          {resent ? (
            <span className="text-amber-600 font-medium">Sent!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-amber-900 font-semibold underline hover:no-underline disabled:opacity-50"
            >
              {resending ? 'Sending...' : 'Resend email'}
            </button>
          )}
        </div>
      )}
      <main className="min-h-screen pb-28 md:pb-10 md:pl-60 md:pt-4">
        {children}
      </main>
      <Nav />
    </>
  );
}
