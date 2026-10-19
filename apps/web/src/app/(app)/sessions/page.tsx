'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { PageHeader } from '@/components/brand';
import { btnPrimary } from '@/components/buttons';
import { GamesList } from '@/components/group/games-list';
import { getSessionsPaginated, getGroups, type ISessionWithDetails, type IGroupWithMembers } from '@/lib/api';
import { UserRole } from '@pitchaside/shared';
import { NewSessionSheet } from '@/components/new-session-sheet';
import { useAuth } from '@/lib/auth';

/** Every group's games in one list, the same rows as a group's Games tab, naming the group on each. */
export default function GamesPage() {
  const { user } = useAuth();
  const canManage = user?.role !== UserRole.TREASURER;
  const [showNewGame, setShowNewGame] = useState(false);
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getSessionsPaginated(page, 10), getGroups()])
      .then(([res, g]) => {
        setSessions(res.data);
        setMeta(res.meta);
        setGroups(g);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  if (loading && sessions.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-28" />
          <div className="h-48 bg-gray-100 rounded-3xl" />
          <div className="h-48 bg-gray-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Games"
        subtitle={meta.total > 0 ? `${meta.total} game${meta.total === 1 ? '' : 's'} across your groups` : undefined}
        actions={
          canManage && groups.length > 0 ? (
            <button onClick={() => setShowNewGame(true)} className={btnPrimary}>
              New game
            </button>
          ) : undefined
        }
      />

      {showNewGame && <NewSessionSheet groups={groups} onClose={() => setShowNewGame(false)} />}

      {meta.total === 0 ? (
        <EmptyState
          icon="calendar"
          title="No games yet"
          description={groups.length > 0 ? 'Schedule a game and share it so players can say they’re in.' : 'Create a group first, then schedule its games here.'}
          actionLabel={groups.length > 0 ? (canManage ? 'Schedule a game' : undefined) : 'Create a group'}
          onAction={groups.length > 0 && canManage ? () => setShowNewGame(true) : undefined}
          actionHref={groups.length > 0 ? undefined : '/groups/new'}
        />
      ) : (
        <>
          <GamesList
            sessions={sessions}
            groupOf={(s) => {
              const g = groupMap.get(s.groupId);
              return g ? { name: g.name, targetPlayers: g.targetPlayers, kickoffTime: g.kickoffTime } : undefined;
            }}
          />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
