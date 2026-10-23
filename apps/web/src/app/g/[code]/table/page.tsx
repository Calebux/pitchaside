import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTableCard, rangeOf, rangeQuery, type TableLinkRange } from './table-card';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ last?: string | string[]; from?: string | string[]; to?: string | string[] }> };

const imagePath = (code: string, range: TableLinkRange) => `/g/${code}/table/image${rangeQuery(range)}`;

/** The link shared to WhatsApp: its preview is the table image. */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { code } = await params;
  const sp = await searchParams;
  const last = rangeOf((k) => sp[k as keyof typeof sp]);
  const t = await getTableCard(code, last);
  if (!t) return { title: 'PitchAside' };
  const leader = t.rows[0];
  const title = leader ? `${leader.name} tops the ${t.groupName} table` : `${t.groupName} — the table`;
  const description = leader
    ? t.rankedBy === 'rating' && leader.ovr != null
      ? `Rated ${leader.ovr} after ${t.games} match day${t.games === 1 ? '' : 's'}. See where you stand on PitchAside.`
      : `${leader.points} points after ${t.games} match day${t.games === 1 ? '' : 's'}. See where you stand on PitchAside.`
    : 'The table fills up after the first match day.';
  const image = { url: imagePath(code, last), width: 1080, height: 1350, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

/** A group's table, shared: the image, then a way in for anyone who isn't in the group yet. */
export default async function SharedTablePage({ params, searchParams }: Props) {
  const { code } = await params;
  const sp = await searchParams;
  const last = rangeOf((k) => sp[k as keyof typeof sp]);
  const t = await getTableCard(code, last);
  if (!t) notFound();

  return (
    <main className="min-h-screen bg-pitch-950 turf-stripes px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG route */}
        <img
          src={imagePath(code, last)}
          alt={`${t.groupName} table`}
          width={1080}
          height={1350}
          className="w-full h-auto rounded-3xl border-2 border-ink shadow-sticker"
        />
        <div className="mt-5 space-y-2">
          <Link
            href={`/g/${code}`}
            className="block w-full py-3.5 text-center text-sm font-bold text-ink bg-volt-400 rounded-xl hover:bg-volt-300 transition-colors"
          >
            Join {t.groupName}
          </Link>
          <Link
            href="/me/club"
            className="block w-full py-3 text-center text-sm font-bold text-white/80 border border-white/20 rounded-xl hover:bg-white/5 transition-colors"
          >
            Already in? See the full table
          </Link>
        </div>
      </div>
    </main>
  );
}
