'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand';
import { NightStadium } from '@/components/illustrations';
import { PhoneSignIn, type VerifiedPhone } from '@/components/phone-sign-in';
import { setPlayerToken } from '@/lib/player';

export default function PlayerLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function onVerified(v: VerifiedPhone) {
    if (!v.token) {
      setError("That number isn't on any team yet. Ask your organiser for the group link to join.");
      return;
    }
    setPlayerToken(v.token);
    router.replace('/me');
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-6">
          <Logo />
        </div>
        <div className="relative h-36 rounded-3xl overflow-hidden bg-pitch-950 border-2 border-ink shadow-sticker mb-6">
          <NightStadium className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
          <p className="absolute left-4 bottom-3 font-display text-2xl font-extrabold text-white leading-tight">
            Your games, dues
            <br />& player card
          </p>
        </div>
        {error && <div className="mb-3 bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}
        <PhoneSignIn title="Player sign in" onVerified={onVerified} />
        <p className="mt-6 text-center text-xs text-gray-500">
          Running the group?{' '}
          <Link href="/signin" className="font-bold text-pitch-600">
            Organiser sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
