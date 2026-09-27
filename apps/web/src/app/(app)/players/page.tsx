'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { getPlayers, deletePlayer } from '@/lib/api';
import type { IPlayer } from '@pitchaside/shared';

export default function PlayersPage() {
  const toast = useToast();
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IPlayer | null>(null);

  function fetchPlayers() {
    return getPlayers()
      .then(setPlayers)
      .catch(() => {});
  }

  useEffect(() => {
    fetchPlayers().finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    const name = `${deleteTarget.firstName} ${deleteTarget.lastName}`;
    setDeleteTarget(null);
    try {
      await deletePlayer(deleteTarget.id);
      await fetchPlayers();
      toast.success(`${name} deleted`);
    } catch {
      toast.error('Failed to delete player');
    }
  }

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Player"
        message={`Delete ${deleteTarget?.firstName} ${deleteTarget?.lastName}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Players</h1>
        <Link
          href="/players/new"
          className="px-4 py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors"
        >
          + New
        </Link>
      </div>

      {players.length > 0 && (
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
        />
      )}

      {players.length === 0 ? (
        <EmptyState
          title="No players registered"
          description="Register players so you can add them to groups."
          actionLabel="Register Player"
          actionHref="/players/new"
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No players match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100"
            >
              <Link
                href={`/players/${player.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="w-10 h-10 rounded-full bg-pitch-100 text-pitch-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {player.firstName.charAt(0)}{player.lastName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {player.firstName} {player.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{player.phone}</p>
                </div>
              </Link>
              <button
                onClick={() => setDeleteTarget(player)}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0 p-1"
                title="Delete player"
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
