'use client';

import { leftToPay } from '@/lib/game-player';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { kitFor } from '@/components/illustrations';
import { PlusIcon, daysFromToday, gameDay, gameStatusOf } from '@/components/money-card';
import { QuickAddPlayers } from '@/components/group/quick-add-players';
import { PlayerSheet, type MemberDue } from '@/components/group/member-sheet';
import { openWhatsApp, paymentDetailsMessage } from '@/lib/whatsapp';
import { useAuth } from '@/lib/auth';
import {
  addMember,
  addMeToGroup,
  formatCurrency,
  getGroup,
  getPlayers,
  removeMember,
  type GroupBilling,
  type IGroupWithMembers,
  type ISessionWithDetails,
} from '@/lib/api';
import { PaymentStatus, PaymentType } from '@pitchaside/shared';
import type { IPlayer } from '@pitchaside/shared';

/**
 * A group's squad: who's in it and where each stands for the next game (or this period's dues),
 * adding players, and one card per player. The Squad tab and a group's page both show this.
 */
export function GroupSquad({
  group,
  sessions,
  billing,
  canManage,
  onGroupChanged,
  onPaymentsChanged,
}: {
  group: IGroupWithMembers;
  /** The group's recent games, for "who still owes" against the next one. */
  sessions: ISessionWithDetails[];
  billing: GroupBilling | null;
  canManage: boolean;
  onGroupChanged: (g: IGroupWithMembers) => void;
  /** Someone joined or left: the games' payment lists change too. */
  onPaymentsChanged: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const id = group.id;
  const [query, setQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'owes' | 'paid' | 'out'>('all');
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  // Players from the organiser's other groups, loaded when "Add player" opens.
  const [allPlayers, setAllPlayers] = useState<IPlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addingMe, setAddingMe] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  async function reloadGroup() {
    onGroupChanged(await getGroup(id));
    onPaymentsChanged();
  }

  function toggleAdd() {
    if (!showAddMember) getPlayers().then(setAllPlayers).catch(() => setAllPlayers([]));
    setShowAddMember((v) => !v);
  }

  async function handleAddMember() {
    if (!selectedPlayerId) return;
    setAddingMember(true);
    try {
      await addMember(id, { playerId: selectedPlayerId });
      await reloadGroup();
      setSelectedPlayerId('');
      toast.success('Player added');
    } catch {
      toast.error('The player wasn’t added. Try again.');
    } finally {
      setAddingMember(false);
    }
  }

  /** The organiser plays too: add their own player record to this group. */
  async function handleAddMe() {
    setAddingMe(true);
    try {
      await addMeToGroup(id);
      await reloadGroup();
      toast.success("You're in the squad");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add you to the group");
    } finally {
      setAddingMe(false);
    }
  }

  function handleRemoveMember(playerId: string, playerName: string, credit = 0) {
    setConfirm({
      title: `Remove ${playerName}?`,
      // Their credit is dropped with them, so say how much before it goes.
      message:
        credit > 0
          ? `${playerName} has ${formatCurrency(credit)} paid ahead. Removing them drops it from the group's books, so send it back to them first if they're owed it. Remove anyway?`
          : `${playerName} comes off this group's list.`,
      confirmLabel: credit > 0 ? 'Remove anyway' : 'Remove',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await removeMember(id, playerId, credit > 0);
          onGroupChanged(await getGroup(id));
          toast.success(`${playerName} removed`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'They weren’t removed. Try again.');
        }
      },
    });
  }

  const memberIds = new Set(group.memberships?.map((m) => m.player.id) || []);
  const availablePlayers = allPlayers.filter((p) => !memberIds.has(p.id));
  const memberCount = group.memberships?.length || 0;
  const myEmail = user?.email.trim().toLowerCase();
  const imAMember = group.memberships?.some((m) => m.player.email?.trim().toLowerCase() === myEmail);
  const offerMe = canManage && !!user && !imAMember;

  // What each member's row says about money: the next game (or this period's dues, for groups
  // that collect monthly/weekly), so "who still owes" reads straight off the list.
  const perGame = group.paymentType === PaymentType.PER_SESSION;
  const nextDue = perGame
    ? sessions
        .filter((s) => s.kind !== 'dues' && s.status === 'upcoming' && daysFromToday(s.date) >= 0)
        .sort((a, b) => gameDay(a.date).getTime() - gameDay(b.date).getTime())[0]
    : sessions
        .filter((s) => s.kind === 'dues' && s.status !== 'cancelled')
        .sort((a, b) => gameDay(b.date).getTime() - gameDay(a.date).getTime())
        .find((s) => daysFromToday(s.date) <= 0);
  const dueLabel = nextDue
    ? nextDue.kind === 'dues' && nextDue.label
      ? `${nextDue.label} dues`
      : gameDay(nextDue.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
    : '';
  const dueOf = (playerId: string): MemberDue => {
    if (!nextDue) return null;
    const p = nextDue.payments?.find((x) => x.playerId === playerId);
    if (!p) return group.requireRsvp ? { label: dueLabel, state: 'out', amount: 0 } : null;
    // Didn't come: off the game, owes nothing.
    if (p.attendance === 'no_show') return { label: dueLabel, state: 'out', amount: 0 };
    const st = gameStatusOf(p);
    return {
      label: dueLabel,
      state: st === PaymentStatus.PAID ? 'paid' : st === PaymentStatus.WAIVED ? 'waived' : 'owes',
      amount: leftToPay(p),
      paidSoFar: p.paidSoFar ?? 0,
    };
  };
  const members = (group.memberships ?? []).map((m) => ({ ...m, due: dueOf(m.player.id) }));
  const paidCount = members.filter((m) => m.due?.state === 'paid').length;
  const owesCount = members.filter((m) => m.due?.state === 'owes').length;
  const outCount = members.filter((m) => m.due?.state === 'out').length;
  // Joined in the last week: worth a word (the exact date is in their card).
  const isNew = (joinedAt: string) => Date.now() - new Date(joinedAt).getTime() < 7 * 86_400_000;
  const sentence = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const q = query.trim().toLowerCase();
  const shown = members
    .filter((m) => memberFilter === 'all' || m.due?.state === memberFilter)
    .filter((m) => !q || `${m.player.firstName} ${m.player.lastName} ${m.player.nickname ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => `${a.player.firstName} ${a.player.lastName}`.localeCompare(`${b.player.firstName} ${b.player.lastName}`));
  const opened = members.find((m) => m.player.id === openMember);

  return (
    <section aria-labelledby="squad-title">
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        variant="danger"
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onCancel={() => setConfirm(null)}
      />
      {opened && (
        <PlayerSheet
          key={opened.player.id}
          player={opened.player}
          membership={{ joinedAt: opened.joinedAt, credit: Number(opened.credit ?? 0), paymentCode: opened.paymentRef, due: opened.due }}
          canEdit={canManage}
          onClose={() => setOpenMember(null)}
          onSaved={(p) =>
            onGroupChanged({ ...group, memberships: group.memberships?.map((m) => (m.player.id === p.id ? { ...m, player: { ...m.player, ...p } } : m)) })
          }
          onSendDetails={
            billing?.account
              ? () =>
                  openWhatsApp(
                    paymentDetailsMessage({
                      firstName: opened.player.firstName,
                      groupName: group.name,
                      account: billing.account!,
                      code: opened.paymentRef,
                      amount: opened.due?.state === 'owes' ? opened.due.amount : undefined,
                      forWhat: opened.due?.state === 'owes' ? opened.due.label : undefined,
                    }),
                    opened.player.phone,
                  )
              : undefined
          }
          onRemove={() => {
            setOpenMember(null);
            handleRemoveMember(opened.player.id, `${opened.player.firstName} ${opened.player.lastName}`, Number(opened.credit ?? 0));
          }}
        />
      )}

      {/* Heading row like the home's sections: a plain title and one text action */}
      <div className="flex items-center justify-between">
        <h2 id="squad-title" className="text-base font-bold text-ink">
          {nextDue ? `${perGame ? 'Payments for' : 'Dues for'} ${dueLabel}` : 'Players'}
        </h2>
        {canManage && (
          <button onClick={toggleAdd} aria-expanded={showAddMember} className="h-11 -my-2 px-1 text-sm font-bold text-pitch-700">
            {showAddMember ? 'Close' : 'Add player'}
          </button>
        )}
      </div>

      {showAddMember && (
        <div className="mt-2 bg-white rounded-3xl border border-gray-100 shadow-card p-4 animate-fade-in-up space-y-4">
          <QuickAddPlayers groupId={id} onAdded={reloadGroup} />
          {availablePlayers.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-[13px] font-bold text-ink mb-2">Already one of your players</p>
              <div className="flex gap-2">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  aria-label="Player to add"
                  className="flex-1 min-w-0 min-h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600"
                >
                  <option value="">Pick from your other groups</option>
                  {availablePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={!selectedPlayerId || addingMember}
                  className="shrink-0 min-h-11 px-4 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 disabled:opacity-40 transition-colors"
                >
                  {addingMember ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!group.memberships?.length ? (
        <div className="mt-2">
          <EmptyState
            icon="users"
            title="No one in the group yet"
            description={canManage ? 'Send the invite link to your group chat, or add players yourself.' : 'Players show up here once the organiser adds them or they join with the link.'}
            actionLabel={canManage && !showAddMember ? 'Add players' : undefined}
            onAction={canManage && !showAddMember ? toggleAdd : undefined}
          />
          {offerMe && (
            <div className="mt-3 text-center">
              <button onClick={handleAddMe} disabled={addingMe} className="h-11 px-3 text-sm font-bold text-pitch-700 disabled:opacity-50">
                {addingMe ? 'Adding you…' : 'Playing too? Add yourself'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {memberCount > 6 && (
            <div className="relative mt-2">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or nickname"
                aria-label="Search the squad"
                className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600"
              />
            </div>
          )}

          {/* Who's paid for the next game: the same filter style as the game page */}
          {nextDue && (
            <div className="mt-3">
              <div
                role="radiogroup"
                aria-label={`Show the squad by payment for ${dueLabel}`}
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${outCount > 0 ? 4 : 3}, minmax(0, 1fr))` }}
              >
                {(
                  [
                    { key: 'all', label: 'All', n: memberCount },
                    { key: 'owes', label: 'To pay', n: owesCount },
                    { key: 'paid', label: 'Paid', n: paidCount },
                    ...(outCount > 0 ? [{ key: 'out', label: 'Not in', n: outCount }] : []),
                  ] as { key: typeof memberFilter; label: string; n: number }[]
                ).map((f) => (
                  <button
                    key={f.key}
                    role="radio"
                    aria-checked={memberFilter === f.key}
                    onClick={() => setMemberFilter(f.key)}
                    className={`h-10 px-1.5 text-[13px] font-bold rounded-full border whitespace-nowrap tabular-nums transition-colors ${
                      memberFilter === f.key ? 'bg-ink border-ink text-volt-300' : 'bg-white border-gray-200 text-gray-700 hover:border-ink'
                    }`}
                  >
                    {f.label} {f.n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {shown.length === 0 && !(offerMe && !q && memberFilter === 'all') ? (
            <p className="mt-6 text-sm text-gray-600 text-center">
              {q
                ? `No one called “${query.trim()}”.`
                : memberFilter === 'owes'
                  ? `Everyone in for ${dueLabel} has paid.`
                  : memberFilter === 'out'
                    ? `Everyone is in for ${dueLabel}.`
                    : 'No one has paid yet.'}
            </p>
          ) : (
            <ul className="mt-2 bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100 overflow-hidden">
              {/* The organiser plays too: a row like "Needs you", not a banner */}
              {offerMe && !q && memberFilter === 'all' && (
                <li>
                  <button
                    onClick={handleAddMe}
                    disabled={addingMe}
                    className="w-full flex items-center gap-3 px-4 min-h-16 py-3 text-left hover:bg-chalk disabled:opacity-60 transition-colors"
                  >
                    <span className="w-10 h-10 rounded-xl bg-volt-300 text-ink flex items-center justify-center shrink-0" aria-hidden>
                      <PlusIcon />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-ink leading-snug">{addingMe ? 'Adding you…' : 'Add yourself'}</span>
                      <span className="block text-xs text-gray-500 mt-0.5 truncate">If you play in this group too</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-pitch-700">Add me</span>
                  </button>
                </li>
              )}
              {shown.map((m) => {
                const name = `${m.player.firstName} ${m.player.lastName}`;
                const kit = kitFor(name);
                // Kept money that's already counted as part of this due isn't also "paid ahead".
                const credit = Number(m.credit ?? 0) - (m.due?.paidSoFar ?? 0);
                const st = m.due?.state;
                const detail = [
                  isNew(m.joinedAt) && 'New this week',
                  m.player.nickname && `“${m.player.nickname}”`,
                  m.role !== 'player' && sentence(m.role),
                  !!m.due?.paidSoFar && `${formatCurrency(m.due.paidSoFar)} paid so far`,
                  credit > 0 && `${formatCurrency(credit)} paid ahead`,
                ].filter(Boolean) as string[];
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => setOpenMember(m.player.id)}
                      className="w-full flex items-center gap-3 px-4 min-h-16 py-3 text-left hover:bg-chalk transition-colors"
                    >
                      <span className={`w-10 h-10 shrink-0 rounded-full ${kit.bg} ${kit.fg} flex items-center justify-center text-sm font-extrabold font-display`} aria-hidden>
                        {m.player.firstName.charAt(0)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-ink leading-snug truncate">{name}</span>
                        {detail.length > 0 && <span className="block text-xs text-gray-500 mt-0.5 truncate">{detail.join(', ')}</span>}
                      </span>
                      {/* Where they stand for that game, set like an amount in a bank list */}
                      {st && (
                        <span className="shrink-0 text-right">
                          {st === 'owes' ? (
                            <>
                              <span className="block font-display text-[15px] font-extrabold text-amber-700 tabular-nums">{formatCurrency(m.due!.amount)}</span>
                              <span className="block text-xs text-gray-500">{m.due!.paidSoFar ? 'Left to pay' : 'To pay'}</span>
                            </>
                          ) : (
                            <span className={`block text-xs font-bold ${st === 'paid' ? 'text-pitch-600' : 'text-gray-400'}`}>
                              {st === 'paid' ? 'Paid' : st === 'waived' ? 'Free' : 'Not in'}
                            </span>
                          )}
                        </span>
                      )}
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
