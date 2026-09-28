'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import {
  getPlayer,
  getGroups,
  getPlayerPayments,
  getPlayerStats,
  updatePlayer,
  deletePlayer,
  formatCurrency,
  type IGroupWithMembers,
} from '@/lib/api';
import { StatCard } from '@/components/stat-card';
import type { IPlayer, IPayment } from '@pitchaside/shared';

const paymentStatusStyles: Record<string, string> = {
  paid: 'bg-pitch-50 text-pitch-700',
  pending: 'bg-amber-50 text-amber-700',
  waived: 'bg-gray-100 text-gray-500',
};

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [player, setPlayer] = useState<IPlayer | null>(null);
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [payments, setPayments] = useState<IPayment[]>([]);
  const [stats, setStats] = useState<{ totalSessions: number; totalPaid: number; totalOwed: number; paymentRate: number } | null>(null);
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
    Promise.all([getPlayer(id), getGroups(), getPlayerPayments(id), getPlayerStats(id)])
      .then(([p, g, pay, s]) => {
        setPlayer(p);
        setGroups(g);
        setPayments(pay);
        setStats(s);
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
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gray-200 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const playerGroups = groups.filter((g) =>
    g.memberships?.some((m) => m.player.id === id)
  );

  const cleanPhone = player.phone.replace(/[^\d+]/g, '');
  const whatsappNumber = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;

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
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
              <input
                value={editData.firstName}
                onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
              <input
                value={editData.lastName}
                onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
            <input
              value={editData.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <input
              value={editData.email}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              placeholder="Optional"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            />
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
              disabled={saving || !editData.firstName.trim() || !editData.lastName.trim() || !editData.phone.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-pitch-600 rounded-xl hover:bg-pitch-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg font-bold shrink-0">
              {player.firstName.charAt(0)}{player.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <h1 className="text-xl font-bold text-gray-900">
                  {player.firstName} {player.lastName}
                </h1>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={startEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Edit player"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete player"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <a
                  href={`tel:${player.phone}`}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {player.phone}
                </a>
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-pitch-700 bg-pitch-50 px-2 py-0.5 rounded-full hover:bg-pitch-100 transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.496A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.594-.822-6.343-2.2l-.444-.355-3.187 1.07 1.07-3.187-.355-.444A9.955 9.955 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                  </svg>
                  WhatsApp
                </a>
              </div>
              {player.email && (
                <a href={`mailto:${player.email}`} className="text-xs text-gray-400 hover:text-gray-600 block mt-1 transition-colors">
                  {player.email}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="Sessions" value={stats.totalSessions} />
          <StatCard label="Payment Rate" value={`${stats.paymentRate}%`} />
          <StatCard label="Total Paid" value={formatCurrency(stats.totalPaid)} />
          <StatCard label="Outstanding" value={formatCurrency(stats.totalOwed)} />
        </div>
      )}

      {/* Groups */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Groups</h2>
        {playerGroups.length === 0 ? (
          <EmptyState
            icon="users"
            title="No groups"
            description="This player isn't a member of any group yet."
          />
        ) : (
          <div className="space-y-2">
            {playerGroups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-pitch-50 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold text-pitch-600">{g.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{g.name}</p>
                    {g.schedule && (
                      <p className="text-xs text-gray-400">{g.schedule}</p>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment History</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No payments"
            description="Payment records will appear here once sessions are created."
          />
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(payment.amount)}</p>
                  {payment.paidAt && (
                    <p className="text-xs text-gray-400">
                      {new Date(payment.paidAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${
                    paymentStatusStyles[payment.status] || 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
