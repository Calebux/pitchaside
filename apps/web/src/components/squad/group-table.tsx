'use client';

import { useCallback, useEffect, useState } from 'react';
import { LeagueTableView } from '@/components/ratings';
import { getGroupTable, type LeagueTable } from '@/lib/api';

/** A group's season table, with its own loading and "didn't load" states. */
export function GroupTable({ groupId }: { groupId: string }) {
  const [table, setTable] = useState<LeagueTable | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getGroupTable(groupId)
      .then(setTable)
      .catch(() => setFailed(true));
  }, [groupId]);

  useEffect(() => {
    setTable(null);
    load();
  }, [load]);

  return (
    <section aria-labelledby="table-title">
      <div className="mb-2">
        <h2 id="table-title" className="text-base font-bold text-ink">
          Table
        </h2>
        <p className="text-xs text-gray-500">Points from players&apos; votes after each game</p>
      </div>
      {table ? (
        <LeagueTableView table={table} />
      ) : failed ? (
        <div className="py-10 text-center" role="alert">
          <p className="text-sm text-gray-600">The table didn&apos;t load.</p>
          <button onClick={load} className="mt-2 h-11 px-3 text-sm font-bold text-pitch-700">
            Try again
          </button>
        </div>
      ) : (
        <div className="h-40 bg-gray-100 rounded-3xl animate-pulse" aria-busy aria-label="Loading the table" />
      )}
    </section>
  );
}
