'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/nav';
import { useAuth } from '@/lib/auth';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pitch-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <main className="min-h-screen pb-20 md:pb-6 md:pl-56">
        {children}
      </main>
      <Nav />
    </>
  );
}
