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
          <div className="h-6 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const memberIds = new Set(group.memberships?.map((m) => m.player.id) || []);
  const availablePlayers = allPlayers.filter((p) => !memberIds.has(p.id));

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
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
            <input
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
            <input
              value={editData.schedule}
              onChange={(e) => setEditData({ ...editData, schedule: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Players</label>
              <input
                type="number"
                min={1}
                value={editData.targetPlayers}
                onChange={(e) => setEditData({ ...editData, targetPlayers: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee per Player</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editData.feePerPlayer}
                onChange={(e) => setEditData({ ...editData, feePerPlayer: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
            <select
              value={editData.paymentType}
              onChange={(e) => setEditData({ ...editData, paymentType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-500"
            >
              <option value={PaymentType.PER_SESSION}>Per Session</option>
              <option value={PaymentType.MONTHLY}>Monthly</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editData.name.trim()}
              className="flex-1 py-2 text-sm font-medium text-white bg-pitch-600 rounded-lg hover:bg-pitch-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <div className="flex gap-2">
              <button
                onClick={startEdit}
                className="px-3 py-1.5 text-xs font-medium text-pitch-600 border border-pitch-200 rounded-lg hover:bg-pitch-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDeleteGroup}
                className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
          {group.description && (
            <p className="text-sm text-gray-500 mt-1">{group.description}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
            {group.schedule && <span>{group.schedule}</span>}
            <span>{formatCurrency(group.feePerPlayer)}/player</span>
            <span className="capitalize">{group.paymentType.replace('_', ' ')}</span>
            <span>{group.memberships?.length || 0}/{group.targetPlayers} players</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('members')}
          className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members' ? 'border-pitch-600 text-pitch-600' : 'border-transparent text-gray-500'
          }`}
        >
          Members ({group.memberships?.length || 0})
        </button>
        <button
          onClick={() => setTab('sessions')}
          className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'sessions' ? 'border-pitch-600 text-pitch-600' : 'border-transparent text-gray-500'
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
            className="w-full mb-3 py-2 text-sm font-medium text-pitch-600 border border-pitch-200 rounded-lg hover:bg-pitch-50 transition-colors"
          >
            + Add Member
          </button>

          {showAddMember && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 space-y-3">
              {availablePlayers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No available players.{' '}
                  <Link href="/players/new" className="text-pitch-600 underline">
                    Register one
                  </Link>
                </p>
              ) : (
                <>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-500"
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
                    className="w-full py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 disabled:opacity-50 transition-colors"
                  >
                    {addingMember ? 'Adding...' : 'Add'}
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
                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pitch-100 text-pitch-700 flex items-center justify-center text-sm font-semibold">
                      {m.player.firstName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.player.firstName} {m.player.lastName}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{m.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleRemoveMember(
                        m.player.id,
                        `${m.player.firstName} ${m.player.lastName}`
                      )
                    }
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
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
            className="w-full mb-3 py-2 text-sm font-medium text-pitch-600 border border-pitch-200 rounded-lg hover:bg-pitch-50 transition-colors"
          >
            + Create Session
          </button>

          {showCreateSession && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 space-y-3">
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Recurrence</label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-500"
                  >
                    <option value="none">None</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {recurrenceType !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Count</label>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={handleCreateSession}
                disabled={!sessionDate || creatingSess}
                className="w-full py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 disabled:opacity-50 transition-colors"
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
                return (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}`}
                    className="block bg-white p-3 rounded-lg border border-gray-100 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(s.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                        s.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                        s.status === 'completed' ? 'bg-green-100 text-green-700' :
                        s.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-pitch-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatCurrency(s.collectedAmount)} / {formatCurrency(s.targetAmount)} ({progress}%)
                    </p>
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
