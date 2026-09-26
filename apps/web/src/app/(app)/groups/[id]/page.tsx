'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import {
  getGroup,
  getSessions,
  getPlayers,
  addMember,
  removeMember,
  createSession,
  type IGroupWithMembers,
  type ISessionWithDetails,
} from '@/lib/api';
import type { IPlayer } from '@pitchaside/shared';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
  const [creatingSess, setCreatingSess] = useState(false);

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

  async function handleAddMember() {
    if (!selectedPlayerId) return;
    setAddingMember(true);
    try {
      await addMember(id, { playerId: selectedPlayerId });
      const updated = await getGroup(id);
      setGroup(updated);
      setShowAddMember(false);
      setSelectedPlayerId('');
    } catch {
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(playerId: string) {
    try {
      await removeMember(id, playerId);
      const updated = await getGroup(id);
      setGroup(updated);
    } catch {}
  }

  async function handleCreateSession() {
    if (!sessionDate) return;
    setCreatingSess(true);
    try {
      const session = await createSession({ groupId: id, date: sessionDate });
      router.push(`/sessions/${session.id}`);
    } catch {
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

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        {group.description && (
          <p className="text-sm text-gray-500 mt-1">{group.description}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
          {group.schedule && <span>{group.schedule}</span>}
          <span>${group.feePerPlayer}/player</span>
          <span className="capitalize">{group.paymentType.replace('_', ' ')}</span>
          <span>{group.memberships?.length || 0}/{group.targetPlayers} players</span>
        </div>
      </div>

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
              title="No members yet"
              description="Add players to this group."
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
                    onClick={() => handleRemoveMember(m.player.id)}
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
              <button
                onClick={handleCreateSession}
                disabled={!sessionDate || creatingSess}
                className="w-full py-2 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 disabled:opacity-50 transition-colors"
              >
                {creatingSess ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          )}

          {sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Create a session to start tracking payments."
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
                      ${s.collectedAmount} / ${s.targetAmount} ({progress}%)
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
