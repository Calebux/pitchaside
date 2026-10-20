'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RatingBreakdownSheet } from '@/components/rating-breakdown-sheet';
import { useRouter } from 'next/navigation';
import { InstallCard, PushToggle } from '@/components/pwa';
import { PlayerCardHero, Section } from '@/components/player-ui';
import { PlayerStats } from '@/components/player-stats';
import { usePlayerProfile } from '@/components/player-shell';
import { PlayerAccountSettings } from '@/components/player-account';
import { KitLine } from '@/components/illustrations';
import { getPlayerRatingBreakdown, logoutPlayer, removeMyPhoto, setMyPhoto, subscribePlayerPush } from '@/lib/player';
import { PhotoPicker } from '@/components/photo-picker';

export default function PlayerProfilePage() {
  const router = useRouter();
  const { profile, refresh } = usePlayerProfile();
  const [explaining, setExplaining] = useState(false);
  if (!profile) return null;
  const r = profile.ratings;

  return (
    <>
      <PlayerCardHero
        firstName={profile.player.firstName}
        lastName={profile.player.lastName}
        ratings={r}
        caption={profile.player.email}
        photoKey={profile.player.photoKey}
        onRatingTap={profile.ratingsPlayerId && r.games > 0 ? () => setExplaining(true) : undefined}
      />
      {explaining && profile.ratingsPlayerId && (
        <RatingBreakdownSheet
          name={`${profile.player.firstName} ${profile.player.lastName}`}
          load={() => getPlayerRatingBreakdown(profile.ratingsPlayerId!)}
          onClose={() => setExplaining(false)}
        />
      )}

      {/* Their own photo: on their card and wherever their name shows, in every club */}
      <div className="mt-4 rounded-3xl bg-white border border-gray-100 shadow-card px-4 py-3">
        <PhotoPicker
          you
          name={`${profile.player.firstName} ${profile.player.lastName}`}
          photoKey={profile.player.photoKey}
          size="w-14 h-14 text-lg"
          onUpload={async (image) => {
            const { photoKey } = await setMyPhoto(image);
            refresh();
            return photoKey;
          }}
          onRemove={async () => {
            await removeMyPhoto();
            refresh();
          }}
        />
      </div>

      <div className="mt-5">
        <PlayerStats ratings={r} you />
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start">
      <div>
      {profile.clubs.length > 0 && (
        <Section title="My clubs">
          <div className="space-y-2">
            {profile.clubs.map((c) => (
              <div key={c.clubName} className="bg-white rounded-2xl border border-gray-100 shadow-card px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-ink">{c.clubName}</p>
                  <span className="text-xs font-bold text-gray-500 tabular-nums">
                    {c.ratings.ovr != null ? `OVR ${c.ratings.ovr}` : 'No rating yet'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{c.groups.map((g) => g.name).join(' · ') || 'No groups'}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Organising">
        {profile.organiser ? (
          <Link
            href="/dashboard"
            className="flex items-center justify-between gap-3 rounded-3xl bg-ink text-white px-5 py-4"
          >
            <span>
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em] text-volt-300">You run</span>
              <span className="font-display text-xl font-extrabold">{profile.organiser.clubName}</span>
            </span>
            <span className="text-xs font-bold text-volt-300">Switch to organising ›</span>
          </Link>
        ) : (
          <Link
            href="/me/start-group"
            className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-volt-300 border-2 border-ink shadow-sticker px-5 py-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-extrabold text-ink leading-tight">Start your own group</span>
              <span className="block text-xs text-ink/70 mt-1">Run your own 5-a-side: collect payments, RSVPs and votes. You keep your player card.</span>
            </span>
            <KitLine className="w-24 h-auto shrink-0" />
          </Link>
        )}
      </Section>

      </div>
      <div>
      <Section title="Account">
        <PlayerAccountSettings
          firstName={profile.player.firstName}
          lastName={profile.player.lastName}
          nickname={profile.player.nickname}
          email={profile.player.email}
          onSaved={refresh}
        />
      </Section>

      <Section title="App">
        <div className="space-y-2">
          <InstallCard />
          <PushToggle save={subscribePlayerPush} />
          <button
            onClick={async () => {
              await logoutPlayer();
              router.replace('/me/login');
            }}
            className="w-full py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-2xl hover:border-ink"
          >
            Sign out
          </button>
        </div>
      </Section>
      </div>
      </div>
    </>
  );
}
