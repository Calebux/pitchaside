'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { getSessions, getGroups, type ISessionWithDetails, type IGroupWithMembers } from '@/lib/api';
import { SessionStatus } from '@pitchaside/shared';

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Upcoming', value: SessionStatus.UPCOMING },
  { label: 'Completed', value: SessionStatus.COMPLETED },
  { label: 'Cancelled', value: SessionStatus.CANCELLED },
];

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSessions(), getGroups()])
      .then(([s, g]) => {
        setSessions(s);
        setGroups(g);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? sessions.filter((s) => s.status === filter) : sessions;
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="flex gap-2">
            <div className="h-8 bg-gray-200 rounded-full w-16" />
            <div className="h-8 bg-gray-200 rounded-full w-20" />
            <div className="h-8 bg-gray-200 rounded-full w-24" />
          </div>
          <div className="h-24 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Sessions</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-pitch-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Create sessions from a group page."
          actionLabel="Go to Groups"
          actionHref="/groups"
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No sessions match this filter.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => {
            const group = groupMap.get(session.groupId);
            const progress = session.targetAmount > 0
              ? Math.round((session.collectedAmount / session.targetAmount) * 100)
              : 0;

            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {group?.name || 'Unknown Group'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(session.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    session.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                    session.status === 'completed' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {session.status}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                  <div
                    className="bg-pitch-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>${session.collectedAmount} / ${session.targetAmount}</span>
                  <span>{progress}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
