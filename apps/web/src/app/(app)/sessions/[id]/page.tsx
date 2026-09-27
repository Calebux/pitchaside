'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { PlayerPaymentRow } from '@/components/player-payment-row';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/components/toast';
import { getSession, markPaid, waivePayment, bulkMarkPaid, deleteSession, updateSessionStatus, exportSessionPaymentsCsv, sendReminders, formatCurrency, type ISessionWithDetails } from '@/lib/api';
import { PaymentStatus, SessionStatus } from '@pitchaside/shared';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [session, setSession] = useState<ISessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMarking, setBulkMarking] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const fetchSession = useCallback(() => {
    return getSession(id)
      .then(setSession)
      .catch(() => router.push('/sessions'));
  }, [id, router]);

  useEffect(() => {
    fetchSession().finally(() => setLoading(false));
  }, [fetchSession]);

  async function handleMarkPaid(paymentId: string) {
    setMarkingId(paymentId);
    try {
      await markPaid(paymentId);
      await fetchSession();
      toast.success('Payment marked as paid');
    } catch {
      toast.error('Failed to mark payment');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleWaive(paymentId: string) {
    setMarkingId(paymentId);
    try {
      await waivePayment(paymentId);
      await fetchSession();
      toast.success('Payment waived');
    } catch {
      toast.error('Failed to waive payment');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleBulkMarkPaid() {
    if (selectedIds.size === 0) return;
    setBulkMarking(true);
    try {
      await bulkMarkPaid(Array.from(selectedIds));
      setSelectedIds(new Set());
      await fetchSession();
      toast.success(`${selectedIds.size} payment(s) marked as paid`);
    } catch {
      toast.error('Failed to mark payments');
    } finally {
      setBulkMarking(false);
    }
  }

  function handleToggle(paymentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    try {
      await deleteSession(id);
      toast.success('Session deleted');
      router.push('/sessions');
    } catch {
      toast.error('Failed to delete session');
    }
  }

  async function handleStatusChange(status: 'upcoming' | 'completed' | 'cancelled') {
    setUpdatingStatus(true);
    try {
      await updateSessionStatus(id, status);
      await fetchSession();
      toast.success(`Session marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading || !session) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const payments = session.payments || [];
  const paidCount = payments.filter((p) => p.status === PaymentStatus.PAID).length;
  const pendingPayments = payments.filter((p) => p.status === PaymentStatus.PENDING);
  const progress = session.targetAmount > 0
    ? Math.round((session.collectedAmount / session.targetAmount) * 100)
    : 0;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Sessions" />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Session"
        message="Are you sure you want to delete this session? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Session</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              session.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
              session.status === 'completed' ? 'bg-green-100 text-green-700' :
              session.status === 'cancelled' ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {session.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSessionPaymentsCsv(id).catch(() => toast.error('Export failed'))}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Export
            </button>
            <button
              onClick={async () => {
                setSendingReminders(true);
                try {
                  const result = await sendReminders(id);
                  toast.success(`Reminders sent to ${result.sent} player(s)`);
                } catch {
                  toast.error('Failed to send reminders');
                } finally {
                  setSendingReminders(false);
                }
              }}
              disabled={sendingReminders}
              className="px-3 py-1.5 text-xs font-medium text-pitch-600 border border-pitch-200 rounded-lg hover:bg-pitch-50 disabled:opacity-50 transition-colors"
            >
              {sendingReminders ? 'Sending...' : 'Send Reminders'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {new Date(session.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>

        {/* Status workflow buttons */}
        <div className="flex gap-2 mt-3">
          {session.status !== SessionStatus.COMPLETED && (
            <button
              onClick={() => handleStatusChange('completed')}
              disabled={updatingStatus}
              className="px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors"
            >
              {updatingStatus ? 'Updating...' : 'Mark Completed'}
            </button>
          )}
          {session.status !== SessionStatus.CANCELLED && (
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={updatingStatus}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {updatingStatus ? 'Updating...' : 'Cancel Session'}
            </button>
          )}
          {session.status !== SessionStatus.UPCOMING && (
            <button
              onClick={() => handleStatusChange('upcoming')}
              disabled={updatingStatus}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {updatingStatus ? 'Updating...' : 'Reopen'}
            </button>
          )}
        </div>
      </div>

      {/* Progress summary */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collected</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(session.collectedAmount)}
              <span className="text-sm font-normal text-gray-400"> / {formatCurrency(session.targetAmount)}</span>
            </p>
          </div>
          <p className="text-sm font-medium text-pitch-600">{paidCount}/{payments.length} paid</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-pitch-500 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Payment tracker */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Payment Tracker</h2>
        {pendingPayments.length > 0 && (
          <button
            onClick={() => {
              if (selectedIds.size > 0) {
                handleBulkMarkPaid();
              } else {
                // Select all pending
                setSelectedIds(new Set(pendingPayments.map((p) => p.id)));
              }
            }}
            disabled={bulkMarking}
            className="px-3 py-1.5 text-xs font-medium text-pitch-600 border border-pitch-200 rounded-lg hover:bg-pitch-50 disabled:opacity-50 transition-colors"
          >
            {bulkMarking
              ? 'Marking...'
              : selectedIds.size > 0
                ? `Mark ${selectedIds.size} Paid`
                : 'Mark All Paid'}
          </button>
        )}
      </div>
      {payments.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No payments yet"
          description="Payments are auto-generated when a session is created from a group with members."
        />
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <PlayerPaymentRow
              key={payment.id}
              playerName={
                payment.player
                  ? `${payment.player.firstName} ${payment.player.lastName}`
                  : 'Unknown Player'
              }
              amount={payment.amount}
              status={payment.status}
              onMarkPaid={() => handleMarkPaid(payment.id)}
              onWaive={() => handleWaive(payment.id)}
              loading={markingId === payment.id}
              selected={selectedIds.has(payment.id)}
              onToggle={() => handleToggle(payment.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
