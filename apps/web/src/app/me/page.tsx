'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand';
import { Ball, Player, kitFor, skins } from '@/components/illustrations';
import { BallLoader, BallSpinner } from '@/components/skeleton';
import { AttributeRow, Avatar } from '@/components/ratings';
import { PayIntoCard } from '@/components/account-card';
import { InstallCard, PushToggle } from '@/components/pwa';
import { useToast } from '@/components/toast';
import { formatCurrency } from '@/lib/api';
import {
  clearPlayerToken,
  getPlayerHome,
  getPlayerToken,
  PlayerAuthError,
  setRsvp,
  subscribePlayerPush,
  type PlayerHome,
} from '@/lib/player';

function niceDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' }) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', opts);
}

function daysUntil(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  const n = Math.round((d - today) / 86400000);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function GameCard({ game, onChange }: { game: PlayerHome['upcoming'][number]; onChange: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const full = game.confirmed >= game.capacity;
  const pct = Math.min(100, Math.round((game.confirmed / Math.max(game.capacity, 1)) * 100));

  async function reply(status: 'in' | 'out') {
    setBusy(status);
    try {
      const res = await setRsvp(game.id, status);
      toast.success(
        res.status === 'in' ? "You're in ⚽" : res.status === 'waitlist' ? "Game's full — you're on the waitlist" : 'Got it — maybe next time',
      );
      await onChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  const statusChip =
    game.myStatus === 'in'
      ? { text: "You're in ✅", cls: 'bg-volt-400 text-ink' }
      : game.myStatus === 'waitlist'
        ? { text: `Waitlist #${game.waitlistPosition ?? '–'}`, cls: 'bg-sun-400 text-ink' }
        : game.myStatus === 'out'
          ? { text: "You're out", cls: 'bg-gray-100 text-gray-600' }
          : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-pitch-600">{daysUntil(game.date)}</p>
          <p className="font-display text-xl font-extrabold text-ink leading-tight truncate">{game.groupName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {niceDate(game.date)}
            {game.schedule ? ` · ${game.schedule}` : ''}
          </p>
        </div>
        {statusChip && (
          <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap ${statusChip.cls}`}>{statusChip.text}</span>
        )}
      </div>

      {game.requireRsvp && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mb-1">
            <span className="tabular-nums">
              {game.confirmed}/{game.capacity} confirmed
            </span>
            {game.waitlist > 0 && <span className="tabular-nums">{game.waitlist} waiting</span>}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={`h-2 rounded-full ${full ? 'bg-kit-500' : 'bg-pitch-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {game.myStatus === 'in' && game.payment?.status === 'pending' && (
        <p className="mt-3 text-xs font-semibold text-amber-800 bg-sun-400/20 rounded-xl px-3 py-2">
          {formatCurrency(game.payment.amount)} to pay for this game — details under “To pay”.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        {game.myStatus === 'in' || game.myStatus === 'waitlist' ? (
          <button
            onClick={() => reply('out')}
            disabled={!!busy}
            className="col-span-2 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-ink disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy === 'out' && <BallSpinner />}
            {game.myStatus === 'waitlist' ? 'Leave the waitlist' : "I can't make it anymore"}
          </button>
        ) : (
          <>
            <button
              onClick={() => reply('in')}
              disabled={!!busy}
              className="py-3 text-sm font-bold text-volt-300 bg-ink rounded-xl hover:bg-pitch-900 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy === 'in' && <BallSpinner />}
              {full && game.requireRsvp ? 'Join waitlist' : "I'm in"}
            </button>
            <button
              onClick={() => reply('out')}
              disabled={!!busy || game.myStatus === 'out'}
              className="py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-ink disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy === 'out' && <BallSpinner />}
              Can&apos;t make it
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlayerHomePage() {
  const router = useRouter();
  const [home, setHome] = useState<PlayerHome | null>(null);

  const load = useCallback(async () => {
    try {
      setHome(await getPlayerHome());
    } catch (err) {
      if (err instanceof PlayerAuthError) router.replace('/me/login');
    }
  }, [router]);

  useEffect(() => {
    if (!getPlayerToken()) {
      router.replace('/me/login');
      return;
    }
    load();
  }, [load, router]);

  if (!home) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BallLoader label="Loading your season…" />
      </div>
    );
  }

  const fullName = `${home.player.firstName} ${home.player.lastName}`;
  const kit = kitFor(fullName);
  const firstTable = home.tables.find((t) => t.me);
  const owedGroups = home.groups.filter((g) => home.owed.some((o) => o.groupId === g.id));
  const totalOwed = home.owed.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-ink/5">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Logo href="/me" size="sm" />
          <button
            onClick={() => {
              clearPlayerToken();
              router.replace('/me/login');
            }}
            className="text-xs font-semibold text-gray-500 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-5">
        {/* Player card */}
        <div className="relative rounded-[28px] bg-ink text-white overflow-hidden shadow-lift">
          <div className="absolute inset-0 turf-stripes" />
          <div className="relative grid grid-cols-[auto_1fr] gap-4 p-5">
            <div className="relative w-24 rounded-2xl bg-gradient-to-b from-pitch-600 to-pitch-800 border border-white/15 overflow-hidden">
              <div className="absolute top-2 left-2 leading-none">
                <p className="font-display text-xl font-extrabold text-volt-300 tabular-nums">{home.ratings.ovr ?? '–'}</p>
                <p className="text-[7px] font-extrabold tracking-[0.14em] text-white/60 mt-0.5">OVR</p>
              </div>
              <svg viewBox="0 0 100 150" className="w-full h-auto mt-3" aria-hidden>
                <Player
                  x={50}
                  y={146}
                  scale={0.82}
                  pose="stand"
                  kit={kit.hex}
                  numberColor={kit.text}
                  skin={skins[(home.player.firstName.length + home.player.lastName.length) % skins.length]}
                  hair={(['short', 'afro', 'buzz', 'bun'] as const)[home.player.lastName.length % 4]}
                  number={home.player.firstName.charAt(0) + home.player.lastName.charAt(0)}
                />
                <Ball x={84} y={138} r={8} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">Hi {home.player.firstName} 👋</p>
              <h1 className="font-display text-2xl font-extrabold leading-tight mt-0.5 truncate">{fullName}</h1>
              <div className="mt-3">
                <AttributeRow ratings={home.ratings} dark />
              </div>
              <p className="text-[11px] text-white/50 mt-2">
                {firstTable?.me
                  ? `#${firstTable.me.rank} in ${firstTable.groupName} · ${firstTable.me.points} pts`
                  : 'Play and get votes to build your card'}
                {home.ratings.potmWins > 0 ? ` · ★ ${home.ratings.potmWins} POTM` : ''}
                {home.ratings.record.w + home.ratings.record.d + home.ratings.record.l > 0
                  ? ` · W${home.ratings.record.w} D${home.ratings.record.d} L${home.ratings.record.l}`
                  : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <InstallCard />
          <PushToggle save={subscribePlayerPush} />
        </div>

        {/* Votes */}
        {home.openVotes.length > 0 && (
          <Section title="Post-match votes">
            <div className="space-y-2">
              {home.openVotes.map((v) => (
                <Link
                  key={v.token}
                  href={`/v/${v.token}`}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
                    v.voted ? 'bg-white border-gray-100' : 'bg-sun-400 border-ink hover:shadow-sticker'
                  }`}
                >
                  <span className="w-9 h-9 rounded-xl bg-ink text-sun-400 flex items-center justify-center font-extrabold shrink-0">★</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-ink">{v.voted ? 'You voted — see results' : 'Who were the stars?'}</span>
                    <span className="block text-xs text-ink/60 truncate">
                      {v.groupName} · {niceDate(v.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-ink">{v.voted ? 'View' : 'Vote'} ›</span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Games */}
        <Section title="Your games">
          {home.upcoming.length === 0 ? (
            <p className="text-sm text-gray-500 bg-chalk rounded-2xl px-4 py-5 text-center">No games scheduled yet. We’ll ping you when there is one.</p>
          ) : (
            <div className="space-y-3">
              {home.upcoming.map((g) => (
                <GameCard key={g.id} game={g} onChange={load} />
              ))}
            </div>
          )}
        </Section>

        {/* Money */}
        <Section
          title="To pay"
          action={
            totalOwed > 0 ? (
              <span className="text-sm font-extrabold text-kit-600 tabular-nums">{formatCurrency(totalOwed)}</span>
            ) : undefined
          }
        >
          {home.owed.length === 0 ? (
            <p className="text-sm font-semibold text-ink bg-volt-100 border border-volt-300 rounded-2xl px-4 py-4 text-center">
              All square ✅ Nothing to pay right now.
            </p>
          ) : (
            <div className="space-y-4">
              {owedGroups.map((g) => {
                const items = home.owed.filter((o) => o.groupId === g.id);
                return (
                  <div key={g.id}>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-card divide-y divide-gray-100 mb-2">
                      {items.map((o) => (
                        <div key={o.id} className="flex items-center justify-between px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-ink truncate">{g.name}</p>
                            <p className="text-xs text-gray-500">
                              {o.label ?? `Game · ${niceDate(o.date, { weekday: 'short', day: 'numeric', month: 'short' })}`}
                            </p>
                          </div>
                          <span className="font-display text-lg font-extrabold text-ink tabular-nums">{formatCurrency(o.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <PayIntoCard account={g.account} fee={g.feePerPlayer} paymentType={g.paymentType} reference={g.paymentRef} />
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Tables */}
        {home.tables.some((t) => t.top.length > 0 && t.top.some((r) => r.points > 0)) && (
          <Section title="The table">
            <div className="space-y-3">
              {home.tables
                .filter((t) => t.top.some((r) => r.points > 0))
                .map((t) => (
                  <div key={t.groupId} className="bg-white rounded-3xl border border-gray-100 shadow-card overflow-hidden">
                    <p className="px-4 py-2.5 bg-ink text-[11px] font-extrabold uppercase tracking-wider text-white/60">{t.groupName}</p>
                    {t.top.map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 ${r.id === home.player.id ? 'bg-volt-100' : ''}`}
                      >
                        <span className="w-5 text-xs font-extrabold text-gray-400 tabular-nums">{r.rank}</span>
                        <Avatar name={r.name} className="w-7 h-7 text-[10px]" />
                        <span className="flex-1 text-sm font-bold text-ink truncate">{r.id === home.player.id ? 'You' : r.name}</span>
                        <span className="font-display font-extrabold text-ink tabular-nums">{r.points}</span>
                      </div>
                    ))}
                    {t.me && t.me.rank > t.top.length && (
                      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-dashed border-gray-200 bg-volt-100">
                        <span className="w-5 text-xs font-extrabold text-gray-400 tabular-nums">{t.me.rank}</span>
                        <Avatar name={fullName} className="w-7 h-7 text-[10px]" />
                        <span className="flex-1 text-sm font-bold text-ink">You</span>
                        <span className="font-display font-extrabold text-ink tabular-nums">{t.me.points}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}
