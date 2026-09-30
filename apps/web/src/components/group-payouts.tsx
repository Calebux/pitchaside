'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import {
  cancelPayout,
  formatCurrency,
  getGroupBalance,
  getGroupPayouts,
  getNigerianBanks,
  getTransferPinStatus,
  initiateGroupPayout,
  nameEnquiry,
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

export function PayoutsPanel({
  groupId,
  onRefresh,
}: {
  groupId: string;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [balance, setBalance] = useState<GroupBalance | null>(null);
  const [payouts, setPayouts] = useState<OutgoingTransfer[]>([]);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [account, setAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [pin, setPin] = useState('');
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

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

  async function verify() {
    if (account.length !== 10 || !bankCode) { toast.error('Enter a bank and 10-digit account number'); return; }
    setVerifying(true);
    setVerifiedName(null);
    try {
      const r = await nameEnquiry(groupId, bankCode, account);
      setVerifiedName(r.accountName);
    } catch (err: any) {
      toast.error(err.message || 'Name enquiry failed');
    } finally {
      setVerifying(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!verifiedName) { toast.error('Verify the account first'); return; }
    setSending(true);
    try {
      await initiateGroupPayout(groupId, {
        amount: Number(amount),
        beneficiaryAccount: account,
        beneficiaryBankCode: bankCode,
        narration: narration || undefined,
        pin,
      });
      toast.success('Transfer initiated');
      setShowForm(false);
      setAmount(''); setBankCode(''); setAccount(''); setNarration(''); setPin(''); setVerifiedName(null);
      await load();
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setSending(false);
    }
  }

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

  const input = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';
  const filteredBanks = bankSearch
    ? banks.filter((b) => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : banks;

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
          <div className="flex gap-6 mt-3 text-xs text-gray-500">
            <span>In: <span className="font-bold text-ink">{formatCurrency(balance.totalIn)}</span></span>
            <span>Out: <span className="font-bold text-ink">{formatCurrency(balance.totalOut)}</span></span>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 w-full py-3 bg-ink text-volt-300 font-bold rounded-xl hover:bg-pitch-900 transition-colors"
            >
              Send money
            </button>
          )}
        </div>
      )}

      {/* Payout form */}
      {showForm && (
        <form onSubmit={send} className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">New transfer</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-ink">
              Cancel
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (₦)</label>
            <input
              type="number"
              min={100}
              max={balance?.available ?? 0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={input}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Bank</label>
            <input
              type="text"
              placeholder="Search banks…"
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className={`${input} mb-1`}
            />
            {(bankSearch || !bankCode) && filteredBanks.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {filteredBanks.map((b) => (
                  <button
                    type="button"
                    key={b.code}
                    onClick={() => { setBankCode(b.code); setBankSearch(b.name); setVerifiedName(null); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-volt-300/20 transition-colors ${
                      bankCode === b.code ? 'bg-volt-300/30 font-bold' : ''
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Account number</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={account}
                onChange={(e) => { setAccount(e.target.value.replace(/\D/g, '').slice(0, 10)); setVerifiedName(null); }}
                placeholder="0123456789"
                className={`${input} flex-1`}
              />
              <button
                type="button"
                onClick={verify}
                disabled={verifying || account.length !== 10 || !bankCode}
                className="px-4 text-sm font-bold text-volt-300 bg-ink rounded-xl hover:bg-pitch-900 disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                {verifying ? 'Checking…' : 'Verify'}
              </button>
            </div>
            {verifiedName && (
              <p className="mt-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                {verifiedName}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Narration (optional)</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Pitch rental — Week 12"
              className={input}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Transfer PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter PIN"
              className={`${input} text-center tracking-[0.3em]`}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !verifiedName || !Number(amount) || pin.length < 4}
            className="w-full py-3 bg-ink text-volt-300 font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : `Send ${amount ? formatCurrency(Number(amount)) : ''}`}
          </button>
        </form>
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
