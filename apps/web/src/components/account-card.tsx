'use client';

import { useState } from 'react';
import type { PaymentType } from '@pitchaside/shared';
import { formatCurrency, type GroupAccount } from '@/lib/api';
import { formatAccountNumber, frequencyShort } from '@/lib/billing';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy(key: string, text: string) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
      });
    },
  };
}

/** "Pay into" card players see: account number, amount, and their personal reference. */
export function PayIntoCard({
  account,
  fee,
  paymentType,
  reference,
  eyebrow = 'Pay into',
}: {
  account: GroupAccount | null;
  fee: number;
  paymentType: PaymentType | string;
  reference?: string;
  eyebrow?: string;
}) {
  const { copied, copy } = useCopy();
  if (!account) {
    return (
      <div className="rounded-3xl bg-chalk border border-gray-200 p-5 text-sm text-gray-600">
        Payment details will appear here once your organiser&apos;s group account is ready.
      </div>
    );
  }
  return (
    <div className="relative rounded-[28px] bg-ink text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 turf-stripes" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">{eyebrow}</p>
            <p className="text-sm font-semibold text-white/70 mt-1">{account.bankName}</p>
          </div>
          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-volt-400 text-ink tabular-nums whitespace-nowrap">
            {formatCurrency(fee)} {frequencyShort(paymentType)}
          </span>
        </div>
        <button onClick={() => copy('acct', account.accountNumber)} className="group mt-4 flex items-center gap-3 text-left w-full">
          <span className="font-display text-[30px] font-extrabold tracking-[0.06em] tabular-nums leading-none">
            {formatAccountNumber(account.accountNumber)}
          </span>
          <span className="ml-auto text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/10 group-hover:bg-volt-400 group-hover:text-ink transition-colors">
            {copied === 'acct' ? 'Copied!' : 'Copy'}
          </span>
        </button>
        <p className="text-sm text-white/60 mt-2">{account.accountName}</p>

        {reference && (
          <button
            onClick={() => copy('ref', reference)}
            className="mt-4 w-full flex items-center justify-between gap-3 rounded-2xl bg-volt-400 text-ink px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/60">Narration / reference</span>
              <span className="font-display text-2xl font-extrabold tracking-[0.12em]">{reference}</span>
            </span>
            <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-ink text-volt-300">
              {copied === 'ref' ? 'Copied!' : 'Copy'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
