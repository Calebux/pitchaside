'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { PageHeader } from '@/components/brand';
import { SessionVotingCard } from '@/components/ratings';
import { getSession, type ISessionWithDetails } from '@/lib/api';

/** Full post-match vote for one game: share link, turnout and live results. */
export default function SessionVotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<ISessionWithDetails | null>(null);

  useEffect(() => {
    getSession(id)
      .then(setSession)
      .catch(() => router.push('/players'));
  }, [id, router]);

  if (!session) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-full w-24" />
          <div className="h-10 bg-gray-200 rounded w-2/3" />
          <div className="h-80 bg-gray-100 rounded-[28px]" />
        </div>
      </div>
    );
  }

  const date = new Date(`${session.date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <BackButton />
      <PageHeader eyebrow="Post-match vote" title={session.group?.name ?? 'Game'} subtitle={date} />

      <SessionVotingCard sessionId={id} groupName={session.group?.name ?? 'Game'} />

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/sessions/${id}`}
          className="py-3 text-sm font-bold text-center text-ink bg-white border border-gray-200 rounded-xl hover:border-ink transition-colors"
        >
          Match payments
        </Link>
        <Link
          href={`/groups/${session.groupId}?tab=table`}
          className="py-3 text-sm font-bold text-center text-volt-300 bg-ink rounded-xl hover:bg-pitch-900 transition-colors"
        >
          Group table
        </Link>
      </div>
    </div>
  );
}
