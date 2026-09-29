'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Logo } from '@/components/brand';
import { OffsideFlag, NightStadium } from '@/components/illustrations';
import { BallLoader, BallSpinner } from '@/components/skeleton';
import { PasswordSignIn } from '@/components/password-sign-in';
import { PlayerSignupForm, type SignupData } from '@/components/player-signup-form';
import { useToast } from '@/components/toast';
import { getOrgByInviteCode } from '@/lib/api';
import { getPlayerToken, joinClubAsPlayer, setPlayerToken, signupFromClubLink } from '@/lib/player';

/** Club invite link: create an account (or sign in), join the club, land in the player app. */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const toast = useToast();

  const [orgName, setOrgName] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [stage, setStage] = useState<'signup' | 'signin'>('signup');
  const [lastPhone, setLastPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSignedIn(!!getPlayerToken());
    getOrgByInviteCode(code)
      .then((res) => setOrgName(res.organizationName))
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [code]);

  function welcome(firstName: string, clubName: string) {
    toast.success(`Welcome to ${clubName}, ${firstName}!`);
    router.replace('/me');
  }

  async function signup(data: SignupData) {
    setError(null);
    try {
      const res = await signupFromClubLink(code, data);
      if (res.token) setPlayerToken(res.token);
      welcome(res.firstName, res.clubName);
    } catch (err: any) {
      setError(err.message);
      // Number already has an account: send them to sign in instead.
      if (/sign in/i.test(err.message)) setStage('signin');
    }
  }

  async function joinSignedIn() {
    setError(null);
    setBusy(true);
    try {
      const res = await joinClubAsPlayer(code);
      welcome(res.firstName, res.clubName);
    } catch (err: any) {
      setError(err.message);
      setSignedIn(!!getPlayerToken());
    } finally {
      setBusy(false);
    }
  }

  async function onSignedIn(token: string) {
    setPlayerToken(token);
    await joinSignedIn();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <BallLoader label="Checking your invite…" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <div className="mt-8">
            <OffsideFlag className="w-48 h-40 mx-auto mb-2" />
            <h1 className="text-2xl font-extrabold text-ink mb-2">Invalid invite link</h1>
            <p className="text-sm text-gray-500">
              This invite link is invalid or has expired. Please ask your organiser for a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Logo />
        </div>
        <div className="relative h-36 rounded-3xl overflow-hidden bg-pitch-950 border-2 border-ink shadow-sticker mb-6">
          <NightStadium className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
          <div className="absolute left-4 right-4 bottom-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">You&apos;ve been called up</p>
            <h1 className="font-display text-2xl font-extrabold text-white leading-tight truncate">Join {orgName}</h1>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {signedIn ? (
          <div className="bg-white rounded-3xl border-2 border-ink shadow-sticker p-5 space-y-3">
            <h2 className="text-xl font-extrabold text-ink">Join the squad</h2>
            <p className="text-sm text-gray-500">You&apos;re signed in on this phone.</p>
            <button
              onClick={joinSignedIn}
              disabled={busy}
              className="w-full py-3.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <BallSpinner />}
              Join {orgName}
            </button>
            <button onClick={() => setSignedIn(false)} className="w-full text-xs font-semibold text-gray-500 hover:text-ink">
              Not you? Use another account
            </button>
          </div>
        ) : stage === 'signin' ? (
          <PasswordSignIn
            title="Welcome back"
            subtitle={`Sign in and we'll add you to ${orgName}.`}
            cta="Sign in & join"
            initialPhone={lastPhone}
            onSignedIn={onSignedIn}
            footer={
              <button
                onClick={() => {
                  setError(null);
                  setStage('signup');
                }}
                className="w-full text-xs font-semibold text-gray-500 hover:text-ink"
              >
                New to PitchAside? Create an account
              </button>
            }
          />
        ) : (
          <PlayerSignupForm
            subtitle="Create your PitchAside account to see your games, pay and vote."
            cta="Join the squad"
            onSubmit={signup}
            onPhoneChange={setLastPhone}
            onSwitchToSignIn={() => {
              setError(null);
              setStage('signin');
            }}
          />
        )}
      </div>
    </div>
  );
}
