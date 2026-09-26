'use client';

import { PaymentStatus } from '@pitchaside/shared';

interface PlayerPaymentRowProps {
  playerName: string;
  amount: number;
  status: PaymentStatus;
  onMarkPaid: () => void;
  loading?: boolean;
}

const statusConfig = {
  [PaymentStatus.PAID]: {
    label: 'Paid',
    badge: 'bg-green-100 text-green-700',
  },
  [PaymentStatus.PENDING]: {
    label: 'Pending',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  [PaymentStatus.WAIVED]: {
    label: 'Waived',
    badge: 'bg-gray-100 text-gray-500',
  },
};

export function PlayerPaymentRow({ playerName, amount, status, onMarkPaid, loading }: PlayerPaymentRowProps) {
  const config = statusConfig[status];
  const canMarkPaid = status === PaymentStatus.PENDING;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        canMarkPaid ? 'border-gray-200 bg-white cursor-pointer active:bg-gray-50' : 'border-gray-100 bg-gray-50'
      }`}
      onClick={canMarkPaid ? onMarkPaid : undefined}
      role={canMarkPaid ? 'button' : undefined}
      tabIndex={canMarkPaid ? 0 : undefined}
      onKeyDown={canMarkPaid ? (e) => { if (e.key === 'Enter') onMarkPaid(); } : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-pitch-100 text-pitch-700 flex items-center justify-center text-sm font-semibold">
          {playerName.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{playerName}</p>
          <p className="text-xs text-gray-500">${amount.toFixed(2)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.badge}`}>
          {config.label}
        </span>
        {canMarkPaid && !loading && (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        )}
        {loading && (
          <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    </div>
  );
}
