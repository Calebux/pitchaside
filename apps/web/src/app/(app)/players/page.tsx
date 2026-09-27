'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Pagination } from '@/components/pagination';
import { useToast } from '@/components/toast';
import { getPlayersPaginated, deletePlayer, exportPlayersCsv, type PaginatedResponse } from '@/lib/api';
import type { IPlayer } from '@pitchaside/shared';

export default function PlayersPage() {
  const toast = useToast();
  const [players, setPlayers] = useState<IPlayer[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IPlayer | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  function fetchPlayers(p = page, s = debouncedSearch) {
    return getPlayersPaginated(p, 10, s || undefined)
      .then((res) => {
        setPlayers(res.data);
        setMeta(res.meta);
      })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    fetchPlayers(page, debouncedSearch).finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }

  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  function handlePageChange(p: number) {
    setPage(p);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const name = `${deleteTarget.firstName} ${deleteTarget.lastName}`;
    setDeleteTarget(null);
    try {
      await deletePlayer(deleteTarget.id);
      await fetchPlayers(page, debouncedSearch);
      toast.success(`${name} deleted`);
    } catch {
      toast.error('Failed to delete player');
    }
  }

  if (loading && players.length === 0) {
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
        <div className="flex items-center gap-2">
          {meta.total > 0 && (
            <button
              onClick={() => exportPlayersCsv().catch(() => toast.error('Export failed'))}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Export
            </button>
          )}
          <Link
            href="/players/new"
            className="px-4 py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors"
          >
            + New
          </Link>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
      />

      {meta.total === 0 && !debouncedSearch ? (
        <EmptyState
          icon="users"
          title="No players registered"
          description="Register players so you can add them to groups and track payments."
          actionLabel="Register Player"
          actionHref="/players/new"
        />
      ) : players.length === 0 ? (
        <EmptyState
          icon="users"
          title="No results"
          description="No players match your search. Try a different term."
        />
      ) : (
        <>
          <div className="space-y-2">
            {players.map((player) => (
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
                    <a
                      href={`tel:${player.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-pitch-600 hover:underline truncate block"
                    >
                      {player.phone}
                    </a>
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
