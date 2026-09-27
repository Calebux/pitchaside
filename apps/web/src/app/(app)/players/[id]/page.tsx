'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import {
  getPlayer,
  getGroups,
  getPlayerPayments,
  updatePlayer,
  deletePlayer,
  type IGroupWithMembers,
} from '@/lib/api';
import type { IPlayer, IPayment } from '@pitchaside/shared';

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [player, setPlayer] = useState<IPlayer | null>(null);
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [payments, setPayments] = useState<IPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    Promise.all([getPlayer(id), getGroups(), getPlayerPayments(id)])
      .then(([p, g, pay]) => {
        setPlayer(p);
        setGroups(g);
        setPayments(pay);
      })
      .catch(() => router.push('/players'))
      .finally(() => setLoading(false));
  }, [id, router]);

  function startEdit() {
    if (!player) return;
    setEditData({
      firstName: player.firstName,
      lastName: player.lastName,
      phone: player.phone,
      email: player.email || '',
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await updatePlayer(id, {
        firstName: editData.firstName.trim(),
        lastName: editData.lastName.trim(),
        phone: editData.phone.trim(),
        email: editData.email.trim() || undefined,
      });
      const updated = await getPlayer(id);
      setPlayer(updated);
      setEditing(false);
      toast.success('Player updated');
    } catch {
      toast.error('Failed to update player');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    try {
      await deletePlayer(id);
      toast.success('Player deleted');
      router.push('/players');
    } catch {
      toast.error('Failed to delete player');
    }
  }

  if (loading || !player) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-24" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const playerGroups = groups.filter((g) =>
    g.memberships?.some((m) => m.player.id === id)
  );

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Players" />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Player"
        message={`Delete ${player.firstName} ${player.lastName}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Header / Edit */}
      {editing ? (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                value={editData.firstName}
                onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={editData.lastName}
                onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={editData.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              value={editData.email}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500"
            />
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
              disabled={saving || !editData.firstName.trim() || !editData.lastName.trim() || !editData.phone.trim()}
              className="flex-1 py-2 text-sm font-medium text-white bg-pitch-600 rounded-lg hover:bg-pitch-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-pitch-100 text-pitch-700 flex items-center justify-center text-lg font-bold shrink-0">
              {player.firstName.charAt(0)}{player.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-gray-900">
                  {player.firstName} {player.lastName}
                </h1>
                <button
                  onClick={startEdit}
                  className="px-3 py-1.5 text-xs font-medium text-pitch-600 border border-pitch-200 rounded-lg hover:bg-pitch-50 transition-colors shrink-0"
                >
                  Edit
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{player.phone}</p>
              {player.email && (
                <p className="text-sm text-gray-500">{player.email}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Groups */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Groups</h2>
        {playerGroups.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Not a member of any group.</p>
        ) : (
          <div className="space-y-2">
            {playerGroups.map((g) => (
              <a
                key={g.id}
                href={`/groups/${g.id}`}
                className="block bg-white p-3 rounded-lg border border-gray-100 hover:shadow-sm transition-shadow"
              >
                <p className="text-sm font-medium text-gray-900">{g.name}</p>
                {g.schedule && (
                  <p className="text-xs text-gray-500">{g.schedule}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No payment history.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">${payment.amount}</p>
                  {payment.paidAt && (
                    <p className="text-xs text-gray-500">
                      {new Date(payment.paidAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    payment.status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
      >
        Delete Player
      </button>
    </div>
  );
}
