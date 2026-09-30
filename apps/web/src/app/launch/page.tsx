'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BallLoader } from '@/components/skeleton';
import { http } from '@/lib/http';

/** Home-screen start URL: organisers go to the dashboard, players to their home. */
export default function LaunchPage() {
  const router = useRouter();

  useEffect(() => {
    // Try organiser session first (cookie-based); fall back to player app
    http
      .get('/auth/me')
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/me'));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <BallLoader label="Kicking off…" />
    </div>
  );
}
