import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlayerCard } from './player-card';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** The link shared to WhatsApp: its preview is the player's card. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getPlayerCard(id);
  if (!c) return { title: 'PitchAside' };
  const title = `${c.name}${c.ovr != null ? ` · ${c.ovr} OVR` : ''} on PitchAside`;
  const description = `${c.games} match day${c.games === 1 ? '' : 's'} · ${c.goals} goal${c.goals === 1 ? '' : 's'} · ${c.potmWins}× Player of the Match${c.clubName ? ` · ${c.clubName}` : ''}`;
  const image = { url: `/card/${id}/image`, width: 1080, height: 1350, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: 'profile' },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

/** A player's card, shared: the image, then a way to get your own. */
export default async function SharedCardPage({ params }: Props) {
  const { id } = await params;
  const c = await getPlayerCard(id);
  if (!c) notFound();

  return (
    <main className="min-h-screen bg-pitch-950 turf-stripes px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG route */}
        <img
          src={`/card/${id}/image`}
          alt={`${c.name}'s player card`}
          width={1080}
          height={1350}
          className="w-full h-auto rounded-3xl border-2 border-ink shadow-sticker"
        />
        <div className="mt-5 space-y-2">
          <Link
            href="/me/profile"
            className="block w-full py-3.5 text-center text-sm font-bold text-ink bg-volt-400 rounded-xl hover:bg-volt-300 transition-colors"
          >
            See your own card
          </Link>
          <Link
            href="/signup"
            className="block w-full py-3 text-center text-sm font-bold text-white/80 border border-white/20 rounded-xl hover:bg-white/5 transition-colors"
          >
            Run your own games? Start a group on PitchAside
          </Link>
        </div>
      </div>
    </main>
  );
}
