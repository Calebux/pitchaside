'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BallLoader } from '@/components/skeleton';
import { getPlayerToken } from '@/lib/player';

/** Home-screen start URL: organisers go to the dashboard, players to their home. */
export default function LaunchPage() {
  const router = useRouter();

  useEffect(() => {
    let organiser = false;
    try {
      organiser = !!localStorage.getItem('pitchaside_token');
    } catch {
      /* ignore */
    }
    router.replace(organiser ? '/dashboard' : getPlayerToken() ? '/me' : '/me/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <BallLoader label="Kicking off…" />
    </div>
  );
}
