'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Pagination } from '@/components/pagination';
import { useToast } from '@/components/toast';
import { getSessionsPaginated, getGroups, deleteSession, formatCurrency, type ISessionWithDetails, type IGroupWithMembers, type PaginatedResponse } from '@/lib/api';
import { SessionStatus } from '@pitchaside/shared';

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Upcoming', value: SessionStatus.UPCOMING },
  { label: 'Completed', value: SessionStatus.COMPLETED },
  { label: 'Cancelled', value: SessionStatus.CANCELLED },
];

const statusStyles: Record<string, string> = {
  upcoming: 'bg-pitch-50 text-pitch-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
};

export default function SessionsPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ISessionWithDetails | null>(null);

  function fetchData(p = page) {
    return Promise.all([getSessionsPaginated(p, 10), getGroups()])
      .then(([res, g]) => {
        setSessions(res.data);
        setMeta(res.meta);
        setGroups(g);
      })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    fetchData(page).finally(() => setLoading(false));
  }, [page]);

  function handlePageChange(p: number) {
    setPage(p);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await deleteSession(deleteTarget.id);
      await fetchData(page);
      toast.success('Session deleted');
    } catch {
      toast.error('Failed to delete session');
    }
  }

  const filtered = filter ? sessions.filter((s) => s.status === filter) : sessions;
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  if (loading && sessions.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-28" />
          <div className="flex gap-2">
            <div className="h-8 bg-gray-100 rounded-full w-14" />
            <div className="h-8 bg-gray-100 rounded-full w-20" />
            <div className="h-8 bg-gray-100 rounded-full w-22" />
          </div>
          <div className="h-28 bg-gray-200 rounded-xl" />
          <div className="h-28 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Session"
        message="Delete this session and all its payment records? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <h1 className="text-xl font-bold text-gray-900 mb-4">Sessions</h1>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {meta.total === 0 ? (
        <EmptyState
          icon="calendar"
          title="No sessions yet"
          description="Create sessions from a group page to start tracking game payments."
          actionLabel="Go to Groups"
          actionHref="/groups"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No sessions match"
          description="Try a different filter to see your sessions."
        />
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map((session) => {
              const group = groupMap.get(session.groupId);
              const progress = session.targetAmount > 0
                ? Math.round((session.collectedAmount / session.targetAmount) * 100)
                : 0;
              const paidCount = session.payments?.filter((p) => p.status === 'paid').length ?? 0;
              const totalCount = session.payments?.length ?? 0;

              return (
                <div key={session.id} className="relative bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <Link
                    href={`/sessions/${session.id}`}
                    className="block p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {group?.name || 'Game'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(session.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${
                        statusStyles[session.status] || 'bg-gray-100 text-gray-500'
                      }`}>
                        {session.status}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          progress >= 100 ? 'bg-pitch-500' :
                          progress >= 50 ? 'bg-pitch-400' :
                          'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 tabular-nums">
                        {formatCurrency(session.collectedAmount)} / {formatCurrency(session.targetAmount)}
                      </span>
                      <span className="text-xs font-medium text-gray-400 tabular-nums">
                        {totalCount > 0 ? `${paidCount}/${totalCount} paid` : `${progress}%`}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => { e.preventDefault(); setDeleteTarget(session); }}
                    className="absolute top-3 right-12 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete session"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
