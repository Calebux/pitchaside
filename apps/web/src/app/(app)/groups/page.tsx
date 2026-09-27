'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { getGroups, deleteGroup, formatCurrency, type IGroupWithMembers } from '@/lib/api';

export default function GroupsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IGroupWithMembers | null>(null);

  function fetchGroups() {
    return getGroups()
      .then(setGroups)
      .catch(() => {});
  }

  useEffect(() => {
    fetchGroups().finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    setDeleteTarget(null);
    try {
      await deleteGroup(deleteTarget.id);
      await fetchGroups();
      toast.success(`"${name}" deleted`);
    } catch {
      toast.error('Failed to delete group');
    }
  }

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
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Group"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

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
          icon="users"
          title="No groups yet"
          description="Create your first 5-aside group to start tracking payments and sessions."
          actionLabel="Create Group"
          actionHref="/groups/new"
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <Link
                href={`/groups/${group.id}`}
                className="block p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
                    {group.schedule && (
                      <p className="text-xs text-gray-500 mt-0.5">{group.schedule}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-pitch-600 bg-pitch-50 px-2 py-1 rounded-full">
                    {formatCurrency(group.feePerPlayer)}/player
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>{group.memberships?.length || 0} / {group.targetPlayers} players</span>
                  <span className="capitalize">{group.paymentType.replace('_', ' ')}</span>
                </div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); setDeleteTarget(group); }}
                className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
