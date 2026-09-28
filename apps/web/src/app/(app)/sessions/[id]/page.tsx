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

const statusStyles: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: 'bg-pitch-50', text: 'text-pitch-700' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-600' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600' },
};

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
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const payments = session.payments || [];
  const paidCount = payments.filter((p) => p.status === PaymentStatus.PAID).length;
  const waivedCount = payments.filter((p) => p.status === PaymentStatus.WAIVED).length;
  const pendingPayments = payments.filter((p) => p.status === PaymentStatus.PENDING);
  const progress = session.targetAmount > 0
    ? Math.round((session.collectedAmount / session.targetAmount) * 100)
    : 0;
  const style = statusStyles[session.status] || { bg: 'bg-gray-100', text: 'text-gray-500' };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Sessions" />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Session"
        message="Delete this session and all payment records? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Hero card */}
      <div className="bg-gray-900 rounded-2xl p-5 mb-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/60 text-xs font-medium">
              {new Date(session.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h1 className="text-xl font-bold mt-0.5">Game Session</h1>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${style.bg} ${style.text}`}>
            {session.status}
          </span>
        </div>

        {/* Financial summary */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{formatCurrency(session.collectedAmount)}</span>
            <span className="text-white/40 text-sm tabular-nums">/ {formatCurrency(session.targetAmount)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all ${
              progress >= 100 ? 'bg-pitch-400' :
              progress >= 50 ? 'bg-pitch-500' :
              'bg-amber-400'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-pitch-400 font-semibold tabular-nums">{paidCount} paid</span>
            {waivedCount > 0 && (
              <span className="text-white/40 tabular-nums">{waivedCount} waived</span>
            )}
            <span className="text-white/40 tabular-nums">{pendingPayments.length} pending</span>
          </div>
          <span className="text-white/60 font-semibold tabular-nums">{progress}%</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {session.status !== SessionStatus.COMPLETED && (
          <button
            onClick={() => handleStatusChange('completed')}
            disabled={updatingStatus}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-pitch-700 bg-pitch-50 rounded-xl hover:bg-pitch-100 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Complete
          </button>
        )}
        {session.status !== SessionStatus.UPCOMING && (
          <button
            onClick={() => handleStatusChange('upcoming')}
            disabled={updatingStatus}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Reopen
          </button>
        )}
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
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          {sendingReminders ? 'Sending...' : 'Remind'}
        </button>
        <button
          onClick={() => exportSessionPaymentsCsv(id).catch(() => toast.error('Export failed'))}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Export CSV"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        {session.status !== SessionStatus.CANCELLED && (
          <button
            onClick={() => handleStatusChange('cancelled')}
            disabled={updatingStatus}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Cancel session"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete session"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
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
                setSelectedIds(new Set(pendingPayments.map((p) => p.id)));
              }
            }}
            disabled={bulkMarking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-pitch-700 bg-pitch-50 rounded-lg hover:bg-pitch-100 disabled:opacity-50 transition-colors"
          >
            {bulkMarking ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Marking...
              </>
            ) : selectedIds.size > 0 ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Mark {selectedIds.size} Paid
              </>
            ) : (
              'Select All'
            )}
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
