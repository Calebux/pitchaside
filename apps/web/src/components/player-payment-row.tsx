'use client';

import { PaymentStatus } from '@pitchaside/shared';
import { formatCurrency } from '@/lib/api';

interface PlayerPaymentRowProps {
  playerName: string;
  amount: number;
  status: PaymentStatus;
  onMarkPaid: () => void;
  onWaive?: () => void;
  loading?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

const statusConfig = {
  [PaymentStatus.PAID]: {
    label: 'Paid',
    badge: 'bg-pitch-50 text-pitch-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  [PaymentStatus.PENDING]: {
    label: 'Pending',
    badge: 'bg-amber-50 text-amber-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  [PaymentStatus.WAIVED]: {
    label: 'Waived',
    badge: 'bg-gray-100 text-gray-500',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    ),
  },
};

export function PlayerPaymentRow({
  playerName,
  amount,
  status,
  onMarkPaid,
  onWaive,
  loading,
  selected,
  onToggle,
}: PlayerPaymentRowProps) {
  const config = statusConfig[status];
  const canAct = status === PaymentStatus.PENDING;

  return (
    <div
      className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
        selected
          ? 'border-pitch-200 bg-pitch-50/30'
          : canAct
            ? 'border-gray-100 bg-white hover:border-gray-200'
            : 'border-gray-100 bg-gray-50/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onToggle !== undefined && canAct && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="w-4 h-4 rounded border-gray-300 text-pitch-600 focus:ring-pitch-500 shrink-0"
          />
        )}
        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold shrink-0">
          {playerName.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{playerName}</p>
          <p className="text-xs text-gray-500 tabular-nums">{formatCurrency(amount)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {loading ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-pitch-600">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        ) : canAct ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onMarkPaid}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-pitch-700 bg-pitch-50 rounded-lg hover:bg-pitch-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Paid
            </button>
            {onWaive && (
              <button
                onClick={onWaive}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Waive
              </button>
            )}
          </div>
        ) : (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${config.badge}`}>
            {config.icon}
            {config.label}
          </span>
        )}
      </div>
    </div>
  );
}
