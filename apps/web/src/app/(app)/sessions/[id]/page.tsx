'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { PlayerPaymentRow } from '@/components/player-payment-row';
import { getSession, markPaid, type ISessionWithDetails } from '@/lib/api';
import { PaymentStatus } from '@pitchaside/shared';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<ISessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

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
    } catch {
    } finally {
      setMarkingId(null);
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
  const progress = session.targetAmount > 0
    ? Math.round((session.collectedAmount / session.targetAmount) * 100)
    : 0;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Sessions" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Session</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
            session.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
            session.status === 'completed' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {session.status}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {new Date(session.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Progress summary */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collected</p>
            <p className="text-xl font-bold text-gray-900">
              ${session.collectedAmount}
              <span className="text-sm font-normal text-gray-400"> / ${session.targetAmount}</span>
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
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment Tracker</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No payments for this session.</p>
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
              loading={markingId === payment.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
