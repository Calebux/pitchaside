'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import { getGroups, getSessions, formatCurrency, type IGroupWithMembers, type ISessionWithDetails } from '@/lib/api';
import { SessionStatus } from '@pitchaside/shared';

export default function Dashboard() {
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGroups(), getSessions()])
      .then(([g, s]) => {
        setGroups(g);
        setSessions(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcomingSessions = sessions.filter((s) => s.status === SessionStatus.UPCOMING);
  const totalTarget = sessions.reduce((sum, s) => sum + s.targetAmount, 0);
  const totalCollected = sessions.reduce((sum, s) => sum + s.collectedAmount, 0);
  const collectionRate = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
          </div>
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Your 5-aside overview</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Groups" value={groups.length} />
        <StatCard label="Upcoming" value={upcomingSessions.length} />
        <StatCard label="Collected" value={`${collectionRate}%`} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Link
          href="/groups/new"
          className="flex-1 text-center py-2.5 px-4 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors"
        >
          + New Group
        </Link>
        <Link
          href="/sessions"
          className="flex-1 text-center py-2.5 px-4 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          View Sessions
        </Link>
      </div>

      {/* Upcoming Sessions */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Upcoming Sessions</h2>
      {upcomingSessions.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No upcoming sessions"
          description="Create a session from a group page to get started."
        />
      ) : (
        <div className="space-y-3">
          {upcomingSessions.slice(0, 5).map((session) => {
            const progress = session.targetAmount > 0
              ? Math.round((session.collectedAmount / session.targetAmount) * 100)
              : 0;
            const group = groups.find((g) => g.id === session.groupId);

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
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-pitch-600">
                    {formatCurrency(session.collectedAmount)} / {formatCurrency(session.targetAmount)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-pitch-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{progress}% collected</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
