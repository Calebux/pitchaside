'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCurrentGroup } from '@/lib/current-group';
import { moneyHref } from '@/lib/money-href';

/**
 * A group no longer has a page of its own: its players are on Squad, its money on Money, its
 * games on Games, and its settings in the group switch. Links made before that (notifications,
 * shared messages, bookmarks) still work: they switch to the group and open the screen they
 * meant. `?tab=` was the old page's section.
 */
function whereTo(id: string, tab: string | null) {
  switch (tab) {
    case 'table':
      return `/squad?group=${id}&view=table`;
    case 'transfers':
      // "Money came in with no name" notifications.
      return moneyHref(id, { unnamed: true });
    case 'money':
      return moneyHref(id);
    case 'payouts':
      return moneyHref(id, { view: 'payouts' });
    case 'games':
    case 'sessions':
      return `/sessions?group=${id}`;
    default:
      // The squad was the page's first section, and "X joined" notifications land here.
      return `/squad?group=${id}`;
  }
}

export default function GroupRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { setGroupId } = useCurrentGroup();

  useEffect(() => {
    setGroupId(id);
    router.replace(whereTo(id, params.get('tab')));
  }, [id, params, router, setGroupId]);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse" aria-busy="true" aria-label="Opening the group">
      <div className="h-7 bg-gray-200 rounded w-24" />
      <div className="mt-4 h-10 bg-gray-100 rounded-full w-48" />
      <div className="mt-4 h-64 bg-gray-100 rounded-3xl" />
    </div>
  );
}
