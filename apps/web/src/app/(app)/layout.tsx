'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth';
import { VerifyEmailModal } from '@/components/verify-email-modal';
import { BallLoader } from '@/components/skeleton';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

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

  return (
    <>
      {!user.emailVerified && <VerifyEmailModal email={user.email} onCheck={refreshUser} />}
      <main className="min-h-screen pb-28 md:pb-10 md:pl-60 md:pt-4">
        {children}
      </main>
      <Nav />
    </>
  );
}
