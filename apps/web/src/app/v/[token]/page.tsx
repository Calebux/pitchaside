'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { KeepHyphens, Logo } from '@/components/brand';
import { NightStadium, OffsideFlag, Trophy } from '@/components/illustrations';
import { BallLoader, BallSpinner } from '@/components/skeleton';
import { Avatar, VoteResultsList, closeTime } from '@/components/ratings';
import { getBallot, type Ballot, type VoteCategory, type VoteResults } from '@/lib/api';
import { TEAMS } from '@/lib/teams';
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
  const [picks, setPicks] = useState<Partial<Record<VoteCategory, string>>>({});
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
  // Everyone who played but you, grouped by side: your team first, then the others by bib.
  const others = ballot.squad.filter((p) => p.id !== voter?.playerId);
  const myTeam = ballot.squad.find((p) => p.id === voter?.playerId)?.team ?? null;
  const keys = [...new Set(others.map((p) => p.team))].sort((x, y) =>
    x === myTeam ? -1 : y === myTeam ? 1 : x === null ? 1 : y === null ? -1 : x.localeCompare(y),
  );
  const sides = keys.map((key) => ({
    key,
    mine: !!key && key === myTeam,
    label: key ? `${TEAMS[key].name}${ballot.captains[key] ? ` · Team ${ballot.captains[key]}` : ''}` : keys.length > 1 ? 'No team' : 'Who played',
    players: others.filter((p) => p.team === key),
  }));
  const picked = others.find((p) => p.id === picks.potm);
  // The optional second question: the best on your own team, from your teammates.
  const mates = myTeam && ballot.categories.some((c) => c.key === 'teammate') ? others.filter((p) => p.team === myTeam) : [];
  const pickedMate = mates.find((p) => p.id === picks.teammate);
  const short = (p: { firstName: string; nickname?: string | null }) => p.nickname || p.firstName;

  /** One player to pick: Player of the Match is one of everyone; best on your team can be cleared. */
  const chip = (p: (typeof others)[number], category: 'potm' | 'teammate') => {
    const selected = picks[category] === p.id;
    const name = `${p.firstName} ${p.lastName}`;
    return (
      <li key={p.id} className="min-w-0">
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={p.nickname ? `${name}, “${p.nickname}”` : name}
          onClick={() => setPicks({ ...picks, [category]: category === 'teammate' && selected ? undefined : p.id })}
          className={`press w-full flex items-center gap-2 h-12 pl-1.5 pr-2.5 rounded-2xl border-2 text-left transition-colors ${
            selected ? 'border-ink bg-volt-300 shadow-sticker' : 'border-gray-100 bg-white hover:border-gray-300'
          }`}
        >
          <Avatar name={name} className="w-8 h-8 text-[10px]" />
          <span className="flex-1 min-w-0 truncate text-[14px] font-bold text-ink">
            {short(p)} {p.lastName.charAt(0)}.
          </span>
          {selected && (
            <svg className="w-4 h-4 shrink-0 text-ink" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </button>
      </li>
    );
  };
  const input =
    'w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

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
                title="Vote for Player of the Match"
                subtitle="One pick: who was Player of the Match? It counts towards the table and their player card. Sign in to vote."
                cta="Sign in & vote"
                onSignedIn={onSignedIn}
              />
            )}
          </div>
        ) : stage === 'ballot' ? (
          <div className="mt-6">
            <h2 className="font-display text-2xl font-extrabold text-ink">Player of the Match</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Hey <span className="font-bold text-ink">{voter?.firstName}</span>, who was best on the pitch? One pick.
            </p>
            <div className="mt-4 space-y-3.5" role="radiogroup" aria-label="Player of the Match">
              {sides.map((side) => (
                <section key={side.key ?? 'all'} aria-label={side.label}>
                  <h3 className="flex items-center gap-2 mb-1.5 text-[13px] font-bold text-gray-700">
                    {side.key && <span className={`w-3 h-3 rounded-sm shrink-0 ${TEAMS[side.key].swatch}`} aria-hidden />}
                    {side.label}
                    {side.mine && <span className="text-[11px] font-semibold text-gray-500">· your team</span>}
                  </h3>
                  <ul className="grid grid-cols-2 gap-2">
                    {side.players.map((p) => chip(p, 'potm'))}
                  </ul>
                </section>
              ))}
            </div>
            {mates.length > 0 && myTeam && (
              <section className="mt-6" aria-labelledby="best-mate">
                <h2 id="best-mate" className="font-display text-xl font-extrabold text-ink">
                  Best on your team <span className="text-sm font-semibold text-gray-500">· optional</span>
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  One of your {TEAMS[myTeam].name}
                  {ballot.captains[myTeam] ? ` (Team ${ballot.captains[myTeam]})` : ''} teammates. Tap again to clear it.
                </p>
                <ul className="mt-2.5 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="best-mate">
                  {mates.map((p) => chip(p, 'teammate'))}
                </ul>
              </section>
            )}
            <p className="mt-3 text-xs text-gray-500">You can&apos;t pick yourself. The winners show when the vote closes.</p>
            {error && <div className="mt-3 bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}
            <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white to-transparent">
              <button
                onClick={handleSubmit}
                disabled={busy || !picks.potm}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-2 h-14 bg-ink text-volt-300 text-[15px] font-bold rounded-2xl shadow-lift hover:bg-pitch-900 transition-colors disabled:opacity-50"
              >
                {busy && <BallSpinner />}
                {picked ? `Vote for ${short(picked)}${pickedMate ? ` and ${short(pickedMate)}` : ''}` : 'Pick Player of the Match'}
              </button>
            </div>
          </div>
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
