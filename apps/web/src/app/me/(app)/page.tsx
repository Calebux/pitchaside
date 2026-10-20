'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ratings';
import { InstallCard, PushToggle } from '@/components/pwa';
import { GameCard, GameRow, LoadError, PlayerCardHero, Section, niceDate } from '@/components/player-ui';
import { CountUpNaira } from '@/components/motion';
import { formatCurrency } from '@/lib/api';
import { getPlayerHome, getPlayerRatingBreakdown, subscribePlayerPush, type PlayerHome } from '@/lib/player';
import { ModeSwitch, usePlayerProfile } from '@/components/player-shell';
import { RatingBreakdownSheet } from '@/components/rating-breakdown-sheet';

export default function PlayerHomePage() {
  const [home, setHome] = useState<PlayerHome | null>(null);
  const { profile } = usePlayerProfile();
  // "How this 80 is made", opened from the card's number.
  const [explaining, setExplaining] = useState(false);
  const [failed, setFailed] = useState<unknown>(null);
  // A failed refresh after it has loaded keeps what's on screen; only a first load shows the error.
  const load = useCallback(
    () =>
      getPlayerHome()
        .then((h) => {
          setHome(h);
          setFailed(null);
        })
        .catch(setFailed),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!home && failed) {
    return (
      <LoadError
        what="Your home"
        error={failed}
        onRetry={() => {
          setFailed(null);
          load();
        }}
      />
    );
  }

  if (!home) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-44 bg-gray-100 rounded-[28px]" />
        <div className="h-32 bg-gray-100 rounded-3xl" />
        <div className="h-32 bg-gray-100 rounded-3xl" />
      </div>
    );
  }

  const r = home.ratings;
  const firstTable = home.tables.find((t) => t.me);
  const caption = [
    firstTable?.me ? `#${firstTable.me.rank} in ${firstTable.groupName} · ${firstTable.me.points} pts` : 'Play, win and get votes to build your card',
    r.record.w + r.record.d + r.record.l ? `W${r.record.w} D${r.record.d} L${r.record.l}` : null,
    r.potmWins ? `★ ${r.potmWins} POTM` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // What to send now, from the server (played games and each group's next one, after part payments).
  const totalOwed = home.groups.reduce((sum, g) => sum + g.toPay, 0);
  const owedNow = home.owed.filter((o) => o.now).length;
  const extra = home.groups.reduce((sum, g) => sum + g.extra, 0);
  const pendingVotes = home.openVotes.filter((v) => !v.voted);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
    {/* The same top as the organiser's home: today's date, a greeting, and the mode switch */}
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pitch-600">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-[26px] leading-tight font-extrabold text-ink mt-0.5">
          {greeting}, {home.player.nickname || home.player.firstName}
        </h1>
      </div>
      <div className="md:hidden shrink-0 pt-1">
        <ModeSwitch organiser={profile?.organiser ?? null} />
      </div>
    </div>
    <div className="md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:gap-8 md:items-start">
      <div>
      {/* Money first, as on the organiser's home: what to send now, in one dark strip */}
      <Link
        href="/me/pay"
        aria-label={totalOwed > 0 ? `To pay now: ${formatCurrency(totalOwed)}. Open Pay` : 'Nothing to pay. Open Pay'}
        className="press relative block overflow-hidden rounded-[28px] bg-ink text-white shadow-card"
      >
        <span className="absolute inset-0 turf-stripes-soft" aria-hidden />
        <span className="relative flex items-center gap-3 p-5">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-white/70">{totalOwed > 0 ? 'To pay now' : 'Your money'}</span>
            {totalOwed > 0 ? (
              <CountUpNaira value={totalOwed} className="block mt-0.5 font-display text-[40px] leading-none font-extrabold text-volt-300" />
            ) : (
              <span className="block mt-0.5 font-display text-[30px] leading-none font-extrabold">All square ✓</span>
            )}
            <span className="block mt-2 text-[13px] text-white/70">
              {totalOwed > 0 ? `For ${owedNow} game${owedNow === 1 ? '' : 's'} · put your payment code on the transfer` : 'Nothing owed right now'}
            </span>
            {extra > 0 && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-sun-400">
                <span className="w-2 h-2 rounded-full bg-sun-400" aria-hidden />
                {formatCurrency(extra)} of yours is with your organiser to sort
              </span>
            )}
          </span>
          <span className="w-11 h-11 shrink-0 rounded-full bg-white/10 flex items-center justify-center" aria-hidden>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </span>
      </Link>

      {/* This week's game, in the organiser's match-day card */}
      <div className="mt-3">
        {home.upcoming.length === 0 ? (
          <div className="rounded-3xl bg-chalk px-5 py-6 text-center">
            <p className="text-[15px] font-bold text-ink">No game coming up</p>
            <p className="mt-1 text-[13px] text-gray-600">
              {home.groups.length ? 'You’ll get a ping when your organiser sets the next one.' : 'Join a group with the link your organiser shares.'}
            </p>
          </div>
        ) : (
          <GameCard game={home.upcoming[0]} onChange={load} />
        )}
      </div>

      {pendingVotes.length > 0 && (
        <div className="mt-3 space-y-2">
          {pendingVotes.map((v) => (
            <Link
              key={v.token}
              href={`/v/${v.token}`}
              className="press flex items-center gap-3 min-h-16 rounded-3xl border-2 border-ink bg-sun-400 px-4 py-3 shadow-sticker"
            >
              <span className="w-10 h-10 rounded-2xl bg-ink text-sun-400 flex items-center justify-center font-extrabold shrink-0" aria-hidden>
                ★
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-ink">Vote for Player of the Match</span>
                <span className="block text-xs text-ink/70 truncate">
                  {v.groupName} · {niceDate(v.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </span>
              <span className="text-[13px] font-extrabold text-ink">Vote ›</span>
            </Link>
          ))}
        </div>
      )}

      {home.upcoming.length > 1 && (
        <Section
          title="Coming up"
          action={
            <Link href="/me/games" className="inline-flex items-center min-h-11 text-[13px] font-bold text-pitch-700">
              All games ›
            </Link>
          }
        >
          <div className="space-y-2">
            {home.upcoming.slice(1).map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Your card">
        <PlayerCardHero
          firstName={home.player.firstName}
          lastName={home.player.lastName}
          ratings={r}
          caption={caption}
          photoKey={home.player.photoKey}
          onRatingTap={profile?.ratingsPlayerId && r.games > 0 ? () => setExplaining(true) : undefined}
        />
      </Section>
      {explaining && profile?.ratingsPlayerId && (
        <RatingBreakdownSheet
          name={`${home.player.firstName} ${home.player.lastName}`}
          load={() => getPlayerRatingBreakdown(profile.ratingsPlayerId!)}
          onClose={() => setExplaining(false)}
        />
      )}
      </div>

      <div>
      {home.tables.some((t) => t.top.some((row) => row.points > 0)) && (
        <Section title="The table">
          <div className="space-y-3">
            {home.tables
              .filter((t) => t.top.some((row) => row.points > 0))
              .map((t) => (
                <div key={t.groupId} className="bg-white rounded-3xl border border-gray-100 shadow-card overflow-hidden">
                  <p className="px-4 py-2.5 bg-ink text-[11px] font-extrabold uppercase tracking-wider text-white/60">{t.groupName}</p>
                  {t.top.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 ${row.id === t.myPlayerId ? 'bg-volt-100' : ''}`}
                    >
                      <span className="w-5 text-xs font-extrabold text-gray-500 tabular-nums">{row.rank}</span>
                      <Avatar name={row.name} className="w-7 h-7 text-[10px]" />
                      <span className="flex-1 text-sm font-bold text-ink truncate">{row.id === t.myPlayerId ? 'You' : row.name}</span>
                      <span className="font-display font-extrabold text-ink tabular-nums">{row.points}</span>
                    </div>
                  ))}
                  {t.me && t.me.rank > t.top.length && (
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-dashed border-gray-200 bg-volt-100">
                      <span className="w-5 text-xs font-extrabold text-gray-500 tabular-nums">{t.me.rank}</span>
                      <Avatar name={`${home.player.firstName} ${home.player.lastName}`} className="w-7 h-7 text-[10px]" />
                      <span className="flex-1 text-sm font-bold text-ink">You</span>
                      <span className="font-display font-extrabold text-ink tabular-nums">{t.me.points}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </Section>
      )}
      <div className="mt-6 space-y-2">
        <InstallCard />
        <PushToggle save={subscribePlayerPush} />
      </div>
      </div>
    </div>
    </>
  );
}
