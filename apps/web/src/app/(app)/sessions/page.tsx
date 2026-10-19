'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/brand';
import { GroupSwitch } from '@/components/group-switch';
import { GamesBrowser } from '@/components/group/games-list';
import { getGroups, type IGroupWithMembers } from '@/lib/api';
import { UserRole } from '@pitchaside/shared';
import { NewSessionSheet } from '@/components/new-session-sheet';
import { useAuth } from '@/lib/auth';
import { useCurrentGroup } from '@/lib/current-group';

/**
 * The current group's games: Coming up and Played (with what's still owed). It follows the same
 * group switch as Home and Money; `?group=` (from a link) switches to that group.
 */
export default function GamesPage() {
  const { user } = useAuth();
  const canManage = user?.role !== UserRole.TREASURER;
  const params = useSearchParams();
  const { groupId: current, setGroupId } = useCurrentGroup();
  const [showNewGame, setShowNewGame] = useState(false);
  const [groups, setGroups] = useState<IGroupWithMembers[] | null>(null);

  // A link naming a group switches to it, for the whole app, until another group is picked.
  const [asked, setAsked] = useState(params.get('group'));
  useEffect(() => {
    if (asked) setGroupId(asked);
  }, [asked, setGroupId]);

  const loadGroups = () =>
    getGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  useEffect(() => {
    loadGroups();
  }, []);

  const groupId = (groups ?? []).some((g) => g.id === (asked ?? current)) ? (asked ?? current) : (groups?.[0]?.id ?? null);
  const group = groups?.find((g) => g.id === groupId) ?? null;

  // Picking here wins over the link's group, and the address stops naming it.
  function pick(id: string) {
    setAsked(null);
    setGroupId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete('group');
    window.history.replaceState(window.history.state, '', url);
  }

  if (!groups) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-7 bg-gray-200 rounded w-28" />
          <div className="h-10 bg-gray-100 rounded-full w-48" />
          <div className="h-12 bg-gray-100 rounded-2xl" />
          <div className="h-36 bg-gray-100 rounded-3xl" />
          <div className="h-36 bg-gray-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Games" subtitle="Who’s in, who’s paid, and what’s left to collect." />

      {showNewGame && group && <NewSessionSheet groups={[group]} onClose={() => setShowNewGame(false)} />}

      {!group ? (
        <EmptyState icon="calendar" title="No games yet" description="Create a group first, then schedule its games here." actionLabel="Create a group" actionHref="/groups/new" />
      ) : (
        <>
          <div className="-mt-2 mb-4">
            <GroupSwitch groups={groups} currentId={group.id} onPick={pick} canManage={canManage} onGroupsChanged={loadGroups} />
          </div>
          <GamesBrowser groups={groups} groupId={group.id} canSchedule={canManage} onNew={() => setShowNewGame(true)} />
        </>
      )}
    </div>
  );
}
