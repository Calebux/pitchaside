'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/brand';
import { GamesBrowser } from '@/components/group/games-list';
import { getGroups, type IGroupWithMembers } from '@/lib/api';
import { UserRole } from '@pitchaside/shared';
import { NewSessionSheet } from '@/components/new-session-sheet';
import { useAuth } from '@/lib/auth';

/**
 * Every group's games in one place: Coming up, To collect and Played, filtered by group. A
 * group's Games tab shows the same list for that group alone; both open the same game page.
 */
export default function GamesPage() {
  const { user } = useAuth();
  const canManage = user?.role !== UserRole.TREASURER;
  const [showNewGame, setShowNewGame] = useState(false);
  const [groups, setGroups] = useState<IGroupWithMembers[] | null>(null);

  useEffect(() => {
    getGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  if (!groups) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-7 bg-gray-200 rounded w-28" />
          <div className="h-12 bg-gray-100 rounded-2xl" />
          <div className="h-24 bg-gray-100 rounded-3xl" />
          <div className="h-24 bg-gray-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Games"
        subtitle={groups.length > 1 ? `Across your ${groups.length} groups` : groups[0]?.name}
      />

      {showNewGame && <NewSessionSheet groups={groups} onClose={() => setShowNewGame(false)} />}

      {groups.length === 0 ? (
        <EmptyState icon="calendar" title="No games yet" description="Create a group first, then schedule its games here." actionLabel="Create a group" actionHref="/groups/new" />
      ) : (
        <GamesBrowser groups={groups} canSchedule={canManage} onNew={() => setShowNewGame(true)} />
      )}
    </div>
  );
}
