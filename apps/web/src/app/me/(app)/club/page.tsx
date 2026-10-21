'use client';

import { usePlayerGroup } from '@/lib/player-group';
import { useState } from 'react';
import { PageHeader } from '@/components/brand';
import { GroupChips } from '@/components/player-ui';
import { usePlayerProfile } from '@/components/player-shell';
import { GroupTable } from '@/components/squad/group-table';
import { GroupStats, type ClubApi, type StatSort } from '@/components/squad/group-stats';
import { getMyGroupRatings, getMyGroupTable, getPlayerRatingBreakdown } from '@/lib/player';

/** The player app's way into the same table and stats the organiser sees, for groups they play in. */
const PLAYER_CLUB: ClubApi = {
  table: getMyGroupTable,
  ratings: getMyGroupRatings,
  breakdown: getPlayerRatingBreakdown,
  playerHref: null,
};

type View = 'table' | 'stats';

/**
 * Club: the group's table with its leaders, and every player ranked in Stats, like the organiser's
 * Squad tab. Tapping a player shows how their rating is made. With more than one group, a row of
 * chips picks which. The view and ranking are kept in the address.
 */
export default function PlayerClubPage() {
  const { profile } = usePlayerProfile();
  const groups = (profile?.clubs ?? []).flatMap((c) => c.groups.map((g) => ({ ...g, clubName: c.clubName })));
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  // The same pick as Home's group switch; the table is always one group, so "all" shows the first.
  const [groupId, pickGroup] = usePlayerGroup(groups);
  const [view, setView] = useState<View>(params?.get('view') === 'stats' ? 'stats' : 'table');
  const [sort, setSort] = useState<StatSort>((params?.get('sort') as StatSort) || 'rating');
  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  const remember = (next: { group?: string; view?: View; sort?: StatSort }) => {
    const url = new URL(window.location.href);
    const v = next.view ?? view;
    url.searchParams.set('group', next.group ?? group?.id ?? '');
    if (v === 'stats') url.searchParams.set('view', 'stats');
    else url.searchParams.delete('view');
    if (v === 'stats') url.searchParams.set('sort', next.sort ?? sort);
    else url.searchParams.delete('sort');
    window.history.replaceState(window.history.state, '', url);
  };
  const pickView = (v: View, rankBy?: StatSort) => {
    setView(v);
    if (rankBy) setSort(rankBy);
    remember({ view: v, sort: rankBy });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader title="Club" subtitle="The table, the leaders, and every player ranked." />

      {!profile ? null : !group ? (
        <div className="rounded-3xl bg-chalk px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-ink">You’re not in a group yet</p>
          <p className="mt-1 text-[13px] text-gray-600">Join with the link your organiser shares, and your club’s table shows here.</p>
        </div>
      ) : (
        <>
          <GroupChips
            groups={groups}
            value={group.id}
            onChange={(id) => {
              if (!id) return;
              pickGroup(id);
              remember({ group: id });
            }}
          />

          <div className="mb-4 grid grid-cols-2 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="Club view">
            {(
              [
                ['table', 'Table'],
                ['stats', 'Stats'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => pickView(key)}
                className={`press h-11 rounded-xl text-[14px] font-bold transition-colors ${view === key ? 'bg-ink text-volt-300' : 'text-ink hover:bg-chalk'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'table' ? (
            <GroupTable key={group.id} groupId={group.id} groupName={group.name} api={PLAYER_CLUB} onSeeAll={(s) => pickView('stats', s)} />
          ) : (
            <GroupStats
              key={group.id}
              groupId={group.id}
              api={PLAYER_CLUB}
              sort={sort}
              onSort={(s) => {
                setSort(s);
                remember({ sort: s });
              }}
            />
          )}
        </>
      )}
    </>
  );
}
