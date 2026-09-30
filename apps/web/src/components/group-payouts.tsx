'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PayeeCard } from '@/components/group-payee';
import { SendMoneyModal } from '@/components/send-money-modal';
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
        <p className="text-xs text-gray-500 mt-1">You need a 4-digit PIN to authorise payouts from group accounts.</p>
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

/**
 * Money is in the account but no notice from Payrep told us about it, so it isn't
 * matched to a player. Says what we know about why, from the last notice.
 */
function UnrecordedNote({ balance }: { balance: GroupBalance }) {
  const time = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const why = !balance.lastNotice
    ? `Payrep hasn't sent PitchAside a payment notice for this account since ${time(balance.noticesSince)}.`
    : balance.lastNotice.outcome === 'rejected'
      ? `Payrep's last notice (${time(balance.lastNotice.at)}) was turned away: its security signature didn't match.`
      : `The last notice we recorded was at ${time(balance.lastNotice.at)}.`;
  return (
    <div className="mt-3 text-xs text-amber-900 bg-sun-400/30 rounded-xl px-3 py-2 space-y-1">
      <p className="font-semibold">
        {formatCurrency(balance.unrecorded)} arrived that isn&apos;t matched to a player yet. It&apos;s in the balance and can be
        sent, but doesn&apos;t count toward anyone&apos;s dues.
      </p>
      <p>{why}</p>
    </div>
  );
}

export function PayoutsPanel({
  groupId,
  groupName,
  onRefresh,
}: {
  groupId: string;
  groupName: string;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [balance, setBalance] = useState<GroupBalance | null>(null);
  const [payouts, setPayouts] = useState<OutgoingTransfer[]>([]);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

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
      toast.success('Payout cancelled');
      setCancelId(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not cancel');
    }
  }

  if (hasPin === false) {
    return <SetPinForm onDone={() => setHasPin(true)} />;
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!cancelId}
        title="Cancel payout"
        message="This will cancel the pending transfer. Are you sure?"
        confirmLabel="Cancel payout"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />

      {/* Balance card */}
      {balance && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Available balance</p>
          <p className="font-display text-3xl font-extrabold text-ink tabular-nums mt-1">
            {formatCurrency(balance.available)}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-gray-500">
            <span>Recorded in: <span className="font-bold text-ink">{formatCurrency(balance.totalIn)}</span></span>
            <span>Out: <span className="font-bold text-ink">{formatCurrency(balance.totalOut)}</span></span>
          </div>
          {balance.unrecorded > 0 && <UnrecordedNote balance={balance} />}
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 w-full py-3 bg-ink text-volt-300 font-bold rounded-xl hover:bg-pitch-900 transition-colors"
          >
            Send money
          </button>
        </div>
      )}

      {/* Pitch owner / facility manager: saved once, paid in one tap */}
      {balance && banks.length > 0 && (
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
          banks={banks}
          available={balance.available}
          onClose={() => setShowForm(false)}
          onSent={async () => {
            await load();
            await onRefresh();
          }}
        />
      )}

      {/* Payout history */}
      {payouts.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No payouts yet"
          description="When you send money from this group's account, payouts show up here."
        />
      ) : (
        payouts.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold text-ink tabular-nums">{formatCurrency(Number(p.amount))}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  → {p.beneficiaryName || p.beneficiaryAccount} · {p.beneficiaryBankName}
                </p>
                {p.narration && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.narration}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">
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
