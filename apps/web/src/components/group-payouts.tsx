'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@pitchaside/shared';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { btnPrimary } from '@/components/buttons';
import { EmptyState } from '@/components/empty-state';
import { PayeeCard } from '@/components/group-payee';
import { SendMoneyModal, type RefundableMember } from '@/components/send-money-modal';
import {
  cancelPayout,
  formatCurrency,
  getGroupBalance,
  getGroupPayouts,
  getNigerianBanks,
  getTransferPinStatus,
  setTransferPin,
  type GroupBalance,
  type NigerianBank,
  type OutgoingTransfer,
} from '@/lib/api';

const statusStyles: Record<OutgoingTransfer['status'], string> = {
  pending: 'bg-sun-400/25 text-amber-800',
  processing: 'bg-sky-300/30 text-sky-800',
  completed: 'bg-volt-300 text-ink',
  failed: 'bg-kit-500/15 text-kit-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

/** What withdrawing is, before the first thing it asks for (a PIN) makes sense. */
function WithdrawIntro() {
  const steps = [
    ['Set a 4-digit PIN', 'You type it each time money leaves the account, so nobody else can send it.'],
    ['Pick who gets paid', 'Save the pitch owner once, or send to any Nigerian bank account.'],
    ['Send', 'The money leaves the group account, and every withdrawal is listed here.'],
  ];
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
      <h3 className="text-base font-bold text-ink">Withdraw from the group account</h3>
      <p className="text-xs text-gray-600 mt-1">Pay the pitch, buy bibs or refund a player, straight from what&apos;s been collected.</p>
      <ol className="mt-4 space-y-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-ink text-volt-300 text-xs font-extrabold flex items-center justify-center" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{title}</span>
              <span className="block text-xs text-gray-600">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SetPinForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== confirm) { toast.error('PINs do not match'); return; }
    setBusy(true);
    try {
      await setTransferPin(pin);
      toast.success('Transfer PIN set');
      onDone();
    } catch (err: any) {
      toast.error(err.message || 'Could not set PIN');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center tracking-[0.3em] focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

  return (
    <form onSubmit={handle} className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 space-y-4">
      <div>
        <h3 className="text-base font-bold text-ink">Set transfer PIN</h3>
        <p className="text-xs text-gray-500 mt-1">You&apos;ll type it every time you withdraw money from any of your groups.</p>
      </div>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="Enter 4-digit PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className={input}
        autoComplete="off"
      />
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="Confirm PIN"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className={input}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={busy || pin.length < 4 || confirm.length < 4}
        className="w-full py-3 bg-ink text-volt-300 font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50"
      >
        {busy ? 'Setting…' : 'Set PIN'}
      </button>
    </form>
  );
}

export function PayoutsPanel({
  groupId,
  groupName,
  refundable = [],
  unsorted = 0,
  onRefresh,
}: {
  groupId: string;
  groupName: string;
  /** Members holding credit, who can be refunded. */
  refundable?: RefundableMember[];
  /** Money in with no name yet: part of the balance, but nobody's payment so far. */
  unsorted?: number;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const { user } = useAuth();
  // Treasurers record payments; sending money out is the organiser's.
  const canSend = user?.role !== UserRole.TREASURER;
  const [balance, setBalance] = useState<GroupBalance | null>(null);
  const [payouts, setPayouts] = useState<OutgoingTransfer[]>([]);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const paidAhead = refundable.reduce((sum, m) => sum + m.credit, 0);

  async function load() {
    const [b, p] = await Promise.all([
      getGroupBalance(groupId),
      getGroupPayouts(groupId),
    ]);
    setBalance(b);
    setPayouts(p);
  }

  useEffect(() => {
    load().catch(() => {});
    getNigerianBanks().then(setBanks).catch(() => {});
    getTransferPinStatus().then((r) => setHasPin(r.hasPin)).catch(() => setHasPin(false));
  }, [groupId]);

  async function handleCancel() {
    if (!cancelId) return;
    try {
      await cancelPayout(cancelId);
      toast.success('Withdrawal cancelled');
      setCancelId(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not cancel');
    }
  }

  if (hasPin === false && canSend) {
    return (
      <div className="space-y-3">
        <WithdrawIntro />
        <SetPinForm onDone={() => setHasPin(true)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!cancelId}
        title="Cancel withdrawal"
        message="This withdrawal hasn't been sent yet. Cancel it?"
        confirmLabel="Cancel withdrawal"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />

      {/* Balance card */}
      {balance && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
          <p className="text-xs font-semibold text-gray-500">Available to withdraw</p>
          <p className="font-display text-[34px] leading-none font-extrabold text-ink tabular-nums mt-1.5">
            {formatCurrency(balance.available)}
          </p>
          <p className="mt-2 text-xs text-gray-500 tabular-nums">
            {formatCurrency(balance.totalIn)} received, {formatCurrency(balance.totalOut)} sent out
          </p>
          {/* What's in the balance that isn't the group's to spend yet, so nobody pays the pitch with it by mistake. */}
          {(paidAhead > 0 || unsorted > 0) && (
            <div className="mt-3 rounded-2xl bg-sun-400/15 px-3.5 py-2.5 text-[13px] leading-snug text-amber-900">
              <p className="font-bold">This includes money that isn’t the group’s to spend yet:</p>
              <ul className="mt-1 space-y-0.5 tabular-nums">
                {paidAhead > 0 && <li>{formatCurrency(paidAhead)} players have paid ahead for their next games</li>}
                {unsorted > 0 && <li>{formatCurrency(unsorted)} with no name yet</li>}
              </ul>
            </div>
          )}
          {balance.manualIn > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {formatCurrency(balance.manualIn)} of that was recorded by hand, so it isn’t included in what you can send.
            </p>
          )}
          {canSend ? (
            <button onClick={() => setShowForm(true)} className={`${btnPrimary} mt-4 w-full`}>
              Send money
            </button>
          ) : (
            <p className="mt-4 text-[13px] text-gray-600">Only the group’s organiser can send money out. You can see every withdrawal here.</p>
          )}
        </div>
      )}

      {/* Pitch owner / facility manager: saved once, paid in one tap */}
      {balance && canSend && banks.length > 0 && (
        <PayeeCard
          groupId={groupId}
          groupName={groupName}
          banks={banks}
          available={balance.available}
          onPaid={async () => {
            await load();
            await onRefresh();
          }}
        />
      )}

      {showForm && balance && (
        <SendMoneyModal
          groupId={groupId}
          groupName={groupName}
          banks={banks}
          available={balance.available}
          refundable={refundable}
          onClose={() => setShowForm(false)}
          onSent={async () => {
            await load();
            await onRefresh();
          }}
        />
      )}

      {/* Withdrawal history, headed like the page's other sections */}
      <h2 className="pt-3 text-base font-bold text-ink">Past withdrawals</h2>
      {payouts.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No withdrawals yet"
          description="When you send money out of this group's account, it shows up here."
        />
      ) : (
        payouts.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold text-ink tabular-nums">
                  {formatCurrency(Number(p.amount))}
                  {Number(p.fee) > 0 && <span className="text-sm font-bold text-gray-500 ml-1">+ {formatCurrency(Number(p.fee))} fee</span>}
                </p>
                {p.refundPlayer && (
                  <p className="text-xs font-bold text-pitch-600 mt-0.5 truncate">
                    Refund to {p.refundPlayer.firstName} {p.refundPlayer.lastName}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  → {p.beneficiaryName || p.beneficiaryAccount} · {p.beneficiaryBankName}
                </p>
                {p.narration && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.narration}</p>}
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {new Date(p.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {p.initiatedBy && ` · ${p.initiatedBy.firstName} ${p.initiatedBy.lastName}`}
                </p>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${statusStyles[p.status]}`}>
                {p.status}
              </span>
            </div>
            {p.errorMessage && (
              <p className="mt-2 text-xs text-kit-600 bg-kit-500/10 rounded-lg px-3 py-1.5">{p.errorMessage}</p>
            )}
            {p.status === 'pending' && (
              <button
                onClick={() => setCancelId(p.id)}
                className="mt-3 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-ink transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
