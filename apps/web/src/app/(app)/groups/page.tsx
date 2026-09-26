'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { getGroups, type IGroupWithMembers } from '@/lib/api';

export default function GroupsPage() {
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGroups()
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <Link
          href="/groups/new"
          className="px-4 py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors"
        >
          + New
        </Link>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create your first 5-aside group to start tracking."
          actionLabel="Create Group"
          actionHref="/groups/new"
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="block bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
                  {group.schedule && (
                    <p className="text-xs text-gray-500 mt-0.5">{group.schedule}</p>
                  )}
                </div>
                <span className="text-xs font-medium text-pitch-600 bg-pitch-50 px-2 py-1 rounded-full">
                  ${group.feePerPlayer}/player
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>{group.memberships?.length || 0} / {group.targetPlayers} players</span>
                <span className="capitalize">{group.paymentType.replace('_', ' ')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
