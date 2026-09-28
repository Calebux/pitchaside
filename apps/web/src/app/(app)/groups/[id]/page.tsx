'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import {
  getGroup,
  getSessions,
  getPlayers,
  addMember,
  removeMember,
  createSession,
  deleteGroup,
  updateGroup,
  formatCurrency,
  type IGroupWithMembers,
  type ISessionWithDetails,
} from '@/lib/api';
import { PaymentType } from '@pitchaside/shared';
import type { IPlayer } from '@pitchaside/shared';

const statusStyles: Record<string, string> = {
  upcoming: 'bg-pitch-50 text-pitch-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [group, setGroup] = useState<IGroupWithMembers | null>(null);
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  const [allPlayers, setAllPlayers] = useState<IPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'sessions'>('members');

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Create session state
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [sessionDate, setSessionDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [creatingSess, setCreatingSess] = useState(false);

  // Edit group state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    schedule: '',
    targetPlayers: 10,
    feePerPlayer: 10,
    paymentType: PaymentType.PER_SESSION as string,
  });
  const [saving, setSaving] = useState(false);

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    Promise.all([getGroup(id), getSessions(id), getPlayers()])
      .then(([g, s, p]) => {
        setGroup(g);
        setSessions(s);
        setAllPlayers(p);
      })
      .catch(() => router.push('/groups'))
      .finally(() => setLoading(false));
  }, [id, router]);

  function startEdit() {
    if (!group) return;
    setEditData({
      name: group.name,
      description: group.description || '',
      schedule: group.schedule || '',
      targetPlayers: group.targetPlayers,
      feePerPlayer: group.feePerPlayer,
      paymentType: group.paymentType,
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await updateGroup(id, {
        name: editData.name,
        description: editData.description || undefined,
        schedule: editData.schedule || undefined,
        targetPlayers: editData.targetPlayers,
        feePerPlayer: editData.feePerPlayer,
        paymentType: editData.paymentType as PaymentType,
      });
      const updated = await getGroup(id);
      setGroup(updated);
      setEditing(false);
      toast.success('Group updated');
    } catch {
      toast.error('Failed to update group');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup() {
    setConfirm({
      title: 'Delete Group',
      message: `Are you sure you want to delete "${group?.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deleteGroup(id);
          toast.success('Group deleted');
          router.push('/groups');
        } catch {
          toast.error('Failed to delete group');
        }
      },
    });
  }

  async function handleAddMember() {
    if (!selectedPlayerId) return;
    setAddingMember(true);
    try {
      await addMember(id, { playerId: selectedPlayerId });
      const updated = await getGroup(id);
      setGroup(updated);
      setShowAddMember(false);
      setSelectedPlayerId('');
      toast.success('Member added');
    } catch {
      toast.error('Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  function handleRemoveMember(playerId: string, playerName: string) {
    setConfirm({
      title: 'Remove Member',
      message: `Remove ${playerName} from this group?`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await removeMember(id, playerId);
          const updated = await getGroup(id);
          setGroup(updated);
          toast.success(`${playerName} removed`);
        } catch {
          toast.error('Failed to remove member');
        }
      },
    });
  }

  async function handleCreateSession() {
    if (!sessionDate) return;
    setCreatingSess(true);
    try {
      const session = await createSession({
        groupId: id,
        date: sessionDate,
        recurrenceType: recurrenceType !== 'none' ? recurrenceType : undefined,
        recurrenceCount: recurrenceType !== 'none' ? recurrenceCount : undefined,
      });
      const msg = recurrenceType !== 'none'
        ? `${recurrenceCount} sessions created`
        : 'Session created';
      toast.success(msg);
      router.push(`/sessions/${session.id}`);
    } catch {
      toast.error('Failed to create session');
      setCreatingSess(false);
    }
  }

  if (loading || !group) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const memberIds = new Set(group.memberships?.map((m) => m.player.id) || []);
  const availablePlayers = allPlayers.filter((p) => !memberIds.has(p.id));
  const memberCount = group.memberships?.length || 0;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Groups" />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onCancel={() => setConfirm(null)}
      />

      {/* Header */}
      {editing ? (
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Group Name</label>
            <input
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Schedule</label>
            <input
              value={editData.schedule}
              onChange={(e) => setEditData({ ...editData, schedule: e.target.value })}
              placeholder="e.g. Every Saturday, 4pm"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Target Players</label>
              <input
                type="number"
                min={1}
                value={editData.targetPlayers}
                onChange={(e) => setEditData({ ...editData, targetPlayers: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fee per Player</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editData.feePerPlayer}
                onChange={(e) => setEditData({ ...editData, feePerPlayer: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Type</label>
            <select
              value={editData.paymentType}
              onChange={(e) => setEditData({ ...editData, paymentType: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            >
              <option value={PaymentType.PER_SESSION}>Per Session</option>
              <option value={PaymentType.MONTHLY}>Monthly</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editData.name.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-pitch-600 rounded-xl hover:bg-pitch-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-pitch-50 rounded-2xl flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-pitch-600">
                  {group.name.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
                {group.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={startEdit}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Edit group"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </button>
              <button
                onClick={handleDeleteGroup}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            {group.schedule && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {group.schedule}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full tabular-nums">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              {memberCount}/{group.targetPlayers}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium tabular-nums">
              {formatCurrency(group.feePerPlayer)}/player
            </span>
            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">
              {group.paymentType.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('members')}
          className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'members' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
          }`}
        >
          Members ({memberCount})
        </button>
        <button
          onClick={() => setTab('sessions')}
          className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'sessions' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
          }`}
        >
          Sessions ({sessions.length})
        </button>
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div>
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="w-full mb-3 py-2.5 text-sm font-semibold text-pitch-700 border border-pitch-200 rounded-xl hover:bg-pitch-50 transition-colors"
          >
            + Add Member
          </button>

          {showAddMember && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 space-y-3">
              {availablePlayers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No available players.{' '}
                  <Link href="/players/new" className="text-pitch-600 font-medium hover:underline">
                    Register one
                  </Link>
                </p>
              ) : (
                <>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
                  >
                    <option value="">Select a player...</option>
                    {availablePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedPlayerId || addingMember}
                    className="w-full py-2.5 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 disabled:opacity-50 transition-colors"
                  >
                    {addingMember ? 'Adding...' : 'Add to Group'}
                  </button>
                </>
              )}
            </div>
          )}

          {!group.memberships?.length ? (
            <EmptyState
              icon="users"
              title="No members yet"
              description="Add players to this group so payments can be tracked."
            />
          ) : (
            <div className="space-y-2">
              {group.memberships.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold">
                      {m.player.firstName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.player.firstName} {m.player.lastName}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleRemoveMember(
                        m.player.id,
                        `${m.player.firstName} ${m.player.lastName}`
                      )
                    }
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove member"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div>
          <button
            onClick={() => setShowCreateSession(!showCreateSession)}
            className="w-full mb-3 py-2.5 text-sm font-semibold text-pitch-700 border border-pitch-200 rounded-xl hover:bg-pitch-50 transition-colors"
          >
            + Create Session
          </button>

          {showCreateSession && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Game Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Recurrence</label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {recurrenceType !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Count</label>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={handleCreateSession}
                disabled={!sessionDate || creatingSess}
                className="w-full py-2.5 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 disabled:opacity-50 transition-colors"
              >
                {creatingSess
                  ? 'Creating...'
                  : recurrenceType !== 'none'
                    ? `Create ${recurrenceCount} Sessions`
                    : 'Create Session'}
              </button>
            </div>
          )}

          {sessions.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No sessions yet"
              description="Create a session to start tracking payments for this group."
            />
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const progress = s.targetAmount > 0
                  ? Math.round((s.collectedAmount / s.targetAmount) * 100)
                  : 0;
                const sStyle = statusStyles[s.status] || 'bg-gray-100 text-gray-500';
                return (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}`}
                    className="block bg-white p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2.5">
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(s.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${sStyle}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          progress >= 100 ? 'bg-pitch-500' :
                          progress >= 50 ? 'bg-pitch-400' :
                          'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 tabular-nums">
                        {formatCurrency(s.collectedAmount)} / {formatCurrency(s.targetAmount)}
                      </span>
                      <span className="text-xs font-medium text-gray-400 tabular-nums">{progress}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
