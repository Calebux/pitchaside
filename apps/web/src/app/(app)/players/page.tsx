'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { getPlayers } from '@/lib/api';
import type { IPlayer } from '@pitchaside/shared';

export default function PlayersPage() {
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlayers()
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
              <div className="w-10 h-10 rounded-full bg-pitch-100 text-pitch-700 flex items-center justify-center text-sm font-semibold shrink-0">
                {player.firstName.charAt(0)}{player.lastName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {player.firstName} {player.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{player.phone}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
