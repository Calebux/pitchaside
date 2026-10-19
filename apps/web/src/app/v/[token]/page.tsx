'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { KeepHyphens, Logo } from '@/components/brand';
import { NightStadium, OffsideFlag, Trophy } from '@/components/illustrations';
import { BallLoader, BallSpinner } from '@/components/skeleton';
import { VoteResultsList, closeTime } from '@/components/ratings';
import { BallotSteps, type Picks } from '@/components/vote/ballot-steps';
import { getBallot, type Ballot, type VoteResults } from '@/lib/api';
import { PasswordSignIn } from '@/components/password-sign-in';
import { ShareCardButton } from '@/components/share-card';
import { getMyBallot, submitMyVotes, PlayerAuthError } from '@/lib/player';

/** `notPlayer`: signed in, but not among the players who played this game. */
type Stage = 'signin' | 'notPlayer' | 'ballot' | 'done';

export default function VotePage() {
  const { token } = useParams<{ token: string }>();
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [stage, setStage] = useState<Stage>('signin');
  const [voter, setVoter] = useState<{ playerId: string; firstName: string } | null>(null);
  const [picks, setPicks] = useState<Picks>({});
  const [results, setResults] = useState<VoteResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMyBallot() {
    setBusy(true);
    setError(null);
    try {
      const v = await getMyBallot(token);
      setVoter({ playerId: v.playerId, firstName: v.firstName });
      setPicks(v.picks);
      setStage('ballot');
    } catch (err: any) {
      // Signed out: sign in. Signed in but didn't play: say so, rather than asking them to sign in again.
      if (err instanceof PlayerAuthError) {
        setError(null);
        setStage('signin');
      } else {
        setError(err.message);
        setStage('notPlayer');
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    getBallot(token).then(setBallot).catch(() => setInvalid(true));
    // Try loading ballot with existing player session cookie
    loadMyBallot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSignedIn() {
    await loadMyBallot();
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = await submitMyVotes(token, picks);
      setResults(res);
      setBallot((b) => (b ? { ...b, ballots: res.ballots } : b));
      setStage('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Could not submit your votes');
    } finally {
      setBusy(false);
    }
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <OffsideFlag className="w-48 h-40 mx-auto mt-8 mb-2" />
          <h1 className="text-2xl font-extrabold text-ink mb-2">This vote link doesn&apos;t work</h1>
          <p className="text-sm text-gray-500">Ask your organiser to share it again from the game page.</p>
        </div>
      </div>
    );
  }

  if (!ballot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BallLoader label="Collecting the ballots…" />
      </div>
    );
  }

  const matchDate = new Date(`${ballot.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const header = (
    <div className="relative h-40 rounded-3xl overflow-hidden bg-pitch-950 border-2 border-ink shadow-sticker">
      <NightStadium className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
      <div className="absolute left-4 right-4 bottom-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">Post-match vote · {matchDate}</p>
        <h1 className="font-display text-[26px] font-extrabold text-white leading-tight"><KeepHyphens text={ballot.groupName ?? ''} /></h1>
      </div>
      <span className="absolute top-3 right-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white/90 text-ink tabular-nums">
        {ballot.ballots}/{ballot.squadSize} voted
      </span>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-6 pb-28">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 min-h-9">
          <Link
            href="/me"
            className="inline-flex items-center gap-1 pl-2 pr-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-full hover:text-ink hover:border-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            My PitchAside
          </Link>
          <Logo size="sm" />
        </div>
        {header}

        {!ballot.open && stage !== 'done' ? (
          <div className="mt-6 text-center bg-chalk rounded-3xl p-6 border border-gray-200">
            <p className="font-display text-xl font-extrabold text-ink">
              {ballot.notYet ? 'The vote opens at full time' : 'Voting has closed'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {ballot.notYet
                ? 'It opens when your organiser ends the game, for 48 hours.'
                : ballot.closesAt
                  ? `Closed ${closeTime(ballot.closesAt)}.`
                  : 'The results are in.'}
            </p>
          </div>
        ) : stage === 'notPlayer' ? (
          <div className="mt-6 text-center bg-chalk rounded-3xl p-6 border border-gray-200">
            <p className="font-display text-xl font-extrabold text-ink">This vote is for the players who played</p>
            <p className="text-sm text-gray-500 mt-1">
              {error ?? 'Only players who came to this game vote.'} You’ll vote after your next game.
            </p>
            <Link href="/me" className="mt-4 inline-flex items-center justify-center px-5 py-3 text-sm font-bold text-volt-300 bg-ink rounded-2xl hover:bg-pitch-900 transition-colors">
              Back to my PitchAside
            </Link>
          </div>
        ) : stage === 'signin' ? (
          <div className="mt-6 space-y-3">
            {error && <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}
            {busy ? (
              <div className="py-10 flex justify-center">
                <BallSpinner className="w-8 h-8" />
              </div>
            ) : (
              <PasswordSignIn
                title="Vote on today’s game"
                subtitle="Player of the Match, your Best VII of the Day and up to three awards. About a minute. Sign in to vote."
                cta="Sign in & vote"
                onSignedIn={onSignedIn}
              />
            )}
          </div>
        ) : stage === 'ballot' && voter ? (
          <BallotSteps
            ballot={ballot}
            me={voter.playerId}
            firstName={voter.firstName}
            picks={picks}
            onPicks={setPicks}
            onSubmit={handleSubmit}
            busy={busy}
            error={error}
          />
        ) : (
          results && (
            <div className="mt-6">
              <div className="text-center">
                <Trophy className="w-40 h-32 mx-auto" />
                <h2 className="text-2xl font-extrabold text-ink mt-1">Vote in. Cheers, {voter?.firstName}!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {results.ballots} of {results.squadSize} have voted.{' '}
                  {results.hidden
                    ? `The winners show when the vote closes${ballot.closesAt ? `, ${closeTime(ballot.closesAt)}` : ''}.`
                    : 'Here’s how it ended.'}
                </p>
              </div>
              {!results.hidden && (
                <>
              <div className="mt-5">
                <VoteResultsList results={results} />
              </div>
              <ShareCardButton
                token={token}
                caption={`⚽ ${ballot.groupName} — match day. Who was Player of the Match?`}
                className="mt-5 w-full py-3.5 text-sm font-bold text-white bg-[#25D366] rounded-2xl hover:brightness-95 transition"
              >
                Share the match card
              </ShareCardButton>
                </>
              )}
              <Link
                href="/me"
                className="mt-2 w-full flex items-center justify-center py-3.5 text-sm font-bold text-volt-300 bg-ink rounded-2xl hover:bg-pitch-900 transition-colors"
              >
                Back to my PitchAside
              </Link>
              <button
                onClick={() => setStage('ballot')}
                disabled={!ballot.open}
                className="mt-2 w-full py-3 text-sm font-semibold text-gray-500 hover:text-ink disabled:hidden"
              >
                Change my vote
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
