'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/brand';
import { NightStadium, OffsideFlag, Trophy } from '@/components/illustrations';
import { BallLoader, BallSpinner } from '@/components/skeleton';
import { Avatar, VoteResultsList, categoryMeta } from '@/components/ratings';
import {
  getBallot,
  identifyVoter,
  submitVotes,
  type Ballot,
  type VoteCategory,
  type VoteResults,
} from '@/lib/api';

type Stage = 'phone' | 'ballot' | 'done';

export default function VotePage() {
  const { token } = useParams<{ token: string }>();
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [voter, setVoter] = useState<{ playerId: string; firstName: string } | null>(null);
  const [picks, setPicks] = useState<Partial<Record<VoteCategory, string>>>({});
  const [results, setResults] = useState<VoteResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBallot(token).then(setBallot).catch(() => setInvalid(true));
  }, [token]);

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const v = await identifyVoter(token, phone.trim());
      setVoter({ playerId: v.playerId, firstName: v.firstName });
      setPicks(v.picks);
      setStage('ballot');
    } catch (err: any) {
      setError(err.message || 'Could not find you on the team sheet');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = await submitVotes(token, phone.trim(), picks);
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
          <p className="text-sm text-gray-500">Ask your organiser to share it again from the session page.</p>
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
  const teammates = ballot.squad.filter((p) => p.id !== voter?.playerId);
  const input =
    'w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

  const header = (
    <div className="relative h-40 rounded-3xl overflow-hidden bg-pitch-950 border-2 border-ink shadow-sticker">
      <NightStadium className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
      <div className="absolute left-4 right-4 bottom-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">Post-match vote · {matchDate}</p>
        <h1 className="font-display text-[26px] font-extrabold text-white leading-tight">{ballot.groupName}</h1>
      </div>
      <span className="absolute top-3 right-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white/90 text-ink tabular-nums">
        {ballot.ballots}/{ballot.squadSize} voted
      </span>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8 pb-28">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <Logo />
        </div>
        {header}

        {!ballot.open && stage !== 'done' ? (
          <div className="mt-6 text-center bg-chalk rounded-3xl p-6 border border-gray-200">
            <p className="font-display text-xl font-extrabold text-ink">
              {ballot.notYet ? 'Voting opens on match day' : 'Voting has closed'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {ballot.notYet
                ? 'Come back after the final whistle.'
                : `Closed on ${new Date(ballot.closesAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`}
            </p>
          </div>
        ) : stage === 'phone' ? (
          <form onSubmit={handleIdentify} className="mt-6 bg-white rounded-3xl border-2 border-ink shadow-sticker p-5 space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-ink">Who were the stars?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Five quick picks. Your votes build everyone&apos;s player rating and the league table.
              </p>
            </div>
            {error && <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}
            <div>
              <label htmlFor="phone" className="block text-xs font-bold text-gray-700 mb-1.5">
                Your phone number
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={input}
                placeholder="The number your organiser has for you"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy || phone.trim().length < 7}
              className="w-full py-3.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <BallSpinner />}
              Start voting
            </button>
          </form>
        ) : stage === 'ballot' ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-gray-600">
              Hey <span className="font-bold text-ink">{voter?.firstName}</span> — tap one teammate for each award.
            </p>
            {ballot.categories.map((c) => {
              const meta = categoryMeta[c.key];
              return (
                <section key={c.key} className="bg-white rounded-3xl border border-gray-100 shadow-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.tone}`}>
                      {meta.short}
                    </span>
                    <h2 className="text-base font-bold text-ink">{c.title}</h2>
                    {c.key === 'potm' && <span className="text-[10px] text-gray-400 ml-auto">required</span>}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {teammates.map((p) => {
                      const selected = picks[c.key] === p.id;
                      const name = `${p.firstName} ${p.lastName}`;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPicks({ ...picks, [c.key]: selected ? undefined : p.id })}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-2.5 transition-all ${
                            selected ? 'border-ink bg-volt-300 -translate-y-0.5 shadow-sticker' : 'border-gray-100 bg-white hover:border-gray-300'
                          }`}
                          aria-pressed={selected}
                        >
                          <Avatar name={name} className="w-10 h-10 text-xs" />
                          <span className="text-xs font-bold text-ink truncate max-w-full">{p.firstName}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {error && <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{error}</div>}
            <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
              <button
                onClick={handleSubmit}
                disabled={busy || !picks.potm}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-2 py-4 bg-ink text-volt-300 text-sm font-bold rounded-2xl shadow-lift hover:bg-pitch-900 transition-colors disabled:opacity-50"
              >
                {busy && <BallSpinner />}
                Submit {Object.values(picks).filter(Boolean).length}/{ballot.categories.length} votes
              </button>
            </div>
          </div>
        ) : (
          results && (
            <div className="mt-6">
              <div className="text-center">
                <Trophy className="w-40 h-32 mx-auto" />
                <h2 className="text-2xl font-extrabold text-ink mt-1">Votes in — cheers, {voter?.firstName}!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {results.ballots} of {results.squadSize} have voted. Here&apos;s how it stands.
                </p>
              </div>
              <div className="mt-5">
                <VoteResultsList results={results} />
              </div>
              <button
                onClick={() => {
                  const potm = results.categories.find((c) => c.key === 'potm')?.standings[0];
                  const text = potm
                    ? `🏆 ${potm.player.firstName} is leading Player of the Match for ${ballot.groupName} (${potm.count} votes). Have you voted? ${window.location.href}`
                    : `Vote for Player of the Match — ${ballot.groupName}: ${window.location.href}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
                }}
                className="mt-5 w-full py-3.5 text-sm font-bold text-white bg-[#25D366] rounded-2xl hover:brightness-95 transition"
              >
                Hype it up in the group chat
              </button>
              <button
                onClick={() => setStage('ballot')}
                disabled={!ballot.open}
                className="mt-2 w-full py-3 text-sm font-semibold text-gray-500 hover:text-ink disabled:hidden"
              >
                Change my votes
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
