'use client';

import { useEffect, useState } from 'react';
import { PayIntoCard } from '@/components/account-card';
import { PageTitle, Section, niceDate } from '@/components/player-ui';
import { formatCurrency } from '@/lib/api';
import { getPlayerPayments, type PlayerPayments } from '@/lib/player';

export default function PlayerPayPage() {
  const [data, setData] = useState<PlayerPayments | null>(null);

  useEffect(() => {
    getPlayerPayments().then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <>
        <PageTitle eyebrow="Money" title="Pay" />
        <div className="space-y-3 animate-pulse">
          <div className="h-24 bg-gray-100 rounded-3xl" />
          <div className="h-44 bg-gray-100 rounded-[28px]" />
        </div>
      </>
    );
  }

  const total = data.owed.reduce((s, o) => s + o.amount, 0);
  const owedGroups = data.groups.filter((g) => data.owed.some((o) => o.groupId === g.id));

  return (
    <>
      <PageTitle eyebrow="Money" title="Pay" />

      <div className={`rounded-3xl px-5 py-4 ${total > 0 ? 'bg-ink text-white' : 'bg-volt-100 border border-volt-300 text-ink'}`}>
        <p className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${total > 0 ? 'text-white/50' : 'text-ink/50'}`}>
          {total > 0 ? 'You owe' : 'Balance'}
        </p>
        <p className="font-display text-3xl font-extrabold tabular-nums">{total > 0 ? formatCurrency(total) : 'All square ✅'}</p>
        {total > 0 && <p className="text-xs text-white/60 mt-1">Put your reference in the transfer narration and it’s marked paid automatically.</p>}
      </div>

      {owedGroups.map((g) => {
        const items = data.owed.filter((o) => o.groupId === g.id);
        return (
          <Section key={g.id} title={g.name}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card divide-y divide-gray-100 mb-3">
              {items.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-semibold text-ink">
                    {o.label ?? `Game · ${niceDate(o.date, { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                  <span className="font-display text-lg font-extrabold text-ink tabular-nums">{formatCurrency(o.amount)}</span>
                </div>
              ))}
            </div>
            <PayIntoCard account={g.account} fee={g.feePerPlayer} paymentType={g.paymentType} reference={g.paymentRef} />
          </Section>
        );
      })}

      <Section title="History">
        {data.paid.length === 0 ? (
          <p className="text-sm text-gray-500 bg-chalk rounded-2xl px-4 py-5 text-center">No payments yet.</p>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-card divide-y divide-gray-100">
            {data.paid.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{p.groupName}</p>
                  <p className="text-xs text-gray-500">
                    {p.label ?? `Game · ${niceDate(p.date, { day: 'numeric', month: 'short' })}`}
                    {p.viaTransfer ? ' · bank transfer' : ''}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block font-display font-extrabold text-ink tabular-nums">{formatCurrency(p.amount)}</span>
                  <span className="block text-[10px] font-bold text-pitch-600">✓ Paid</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {data.groups.length > 0 && owedGroups.length === 0 && (
        <Section title="Where to pay">
          <div className="space-y-3">
            {data.groups.map((g) => (
              <div key={g.id}>
                <p className="text-xs font-bold text-gray-500 mb-1.5">{g.name}</p>
                <PayIntoCard account={g.account} fee={g.feePerPlayer} paymentType={g.paymentType} reference={g.paymentRef} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
