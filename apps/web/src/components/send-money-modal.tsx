'use client';

import { useEffect, useId, useState } from 'react';
import { BankPicker } from '@/components/group-payee';
import { Sheet } from '@/components/sheet';
import { BallSpinner } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { formatCurrency, initiateGroupPayout, nameEnquiry, type NigerianBank } from '@/lib/api';

const input =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

type Lookup = { state: 'idle' } | { state: 'checking' } | { state: 'found'; name: string } | { state: 'failed'; message: string };

/**
 * The account holder's name, looked up as soon as there's a bank and a 10-digit
 * number — no "Verify" step. A newer lookup always wins over an older, slower one.
 */
function useAccountName(groupId: string, bankCode: string, account: string): Lookup {
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });

  useEffect(() => {
    if (!bankCode || account.length !== 10) {
      setLookup({ state: 'idle' });
      return;
    }
    let current = true;
    setLookup({ state: 'checking' });
    nameEnquiry(groupId, bankCode, account)
      .then((r) => current && setLookup(r.accountName ? { state: 'found', name: r.accountName } : { state: 'failed', message: 'No name came back for this account' }))
      .catch((err) => current && setLookup({ state: 'failed', message: err instanceof Error ? err.message : "Couldn't check this account" }));
    return () => {
      current = false;
    };
  }, [groupId, bankCode, account]);

  return lookup;
}

/** Send money from the group's account to any Nigerian bank account. */
export function SendMoneyModal({
  groupId,
  banks,
  available,
  onClose,
  onSent,
}: {
  groupId: string;
  banks: NigerianBank[];
  available: number;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const titleId = useId();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [account, setAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [pin, setPin] = useState('');
  const [sending, setSending] = useState(false);
  const lookup = useAccountName(groupId, bankCode, account);

  const value = Number(amount);
  const tooMuch = value > available;
  const ready = lookup.state === 'found' && value >= 100 && !tooMuch && pin.length === 4;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSending(true);
    try {
      await initiateGroupPayout(groupId, {
        amount: value,
        beneficiaryAccount: account,
        beneficiaryBankCode: bankCode,
        narration: narration.trim() || undefined,
        pin,
      });
      toast.success(`Sending ${formatCurrency(value)} to ${lookup.name}`);
      await onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left">
      <form onSubmit={send} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-extrabold text-ink">
            Send money
          </h2>
          <button type="button" onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-ink">
            Close
          </button>
        </div>
        <p className="text-xs text-gray-500 -mt-1">
          From the group&apos;s account · <span className="font-bold text-ink">{formatCurrency(available)}</span> available
        </p>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Bank</label>
          <BankPicker banks={banks} value={bankCode} onChange={setBankCode} />
        </div>

        <div>
          <label htmlFor={`${titleId}-acct`} className="text-xs font-semibold text-gray-600 mb-1 block">
            Account number
          </label>
          <input
            id={`${titleId}-acct`}
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="0123456789"
            className={input}
          />
          <div role="status" className="min-h-5 mt-1.5 text-sm">
            {lookup.state === 'checking' && (
              <span className="inline-flex items-center gap-2 text-gray-500">
                <BallSpinner /> Checking the name…
              </span>
            )}
            {lookup.state === 'found' && (
              <span className="block font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">{lookup.name}</span>
            )}
            {lookup.state === 'failed' && <span className="text-kit-600 text-xs font-semibold">{lookup.message}</span>}
          </div>
        </div>

        <div>
          <label htmlFor={`${titleId}-amt`} className="text-xs font-semibold text-gray-600 mb-1 block">
            Amount (₦)
          </label>
          <input
            id={`${titleId}-amt`}
            type="number"
            min={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={input}
          />
          {tooMuch && <p className="text-xs text-kit-600 mt-1">More than the {formatCurrency(available)} available.</p>}
        </div>

        <div>
          <label htmlFor={`${titleId}-note`} className="text-xs font-semibold text-gray-600 mb-1 block">
            Narration <span className="text-gray-400 font-medium">(optional)</span>
          </label>
          <input
            id={`${titleId}-note`}
            type="text"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="e.g. Pitch rental — Week 12"
            className={input}
          />
        </div>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="Transfer PIN"
          aria-label="Transfer PIN"
          className={`${input} text-center tracking-[0.3em]`}
          autoComplete="off"
        />

        <button
          type="submit"
          disabled={!ready || sending}
          className="w-full py-3 bg-ink text-volt-300 font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending && <BallSpinner />}
          {sending ? 'Sending…' : value ? `Send ${formatCurrency(value)}` : 'Send'}
        </button>
      </form>
    </Sheet>
  );
}
