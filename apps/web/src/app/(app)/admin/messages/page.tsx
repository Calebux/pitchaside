'use client';

import { useEffect, useState } from 'react';
import { BackButton } from '@/components/back-button';
import { PageHeader } from '@/components/brand';
import { EmptyState } from '@/components/empty-state';
import { getMessages, type OutboundMessage } from '@/lib/api';

const kindLabels: Record<string, string> = {
  otp: 'Sign-in code',
  receipt: 'Payment receipt',
  dues_open: 'Dues open',
  rsvp_open: "Who's in?",
  rsvp_promoted: 'Off the waitlist',
  rsvp_nudge: 'RSVP nudge',
  game_reminder: 'Game reminder',
  vote_open: 'Vote invite',
};

/** Everything PitchAside has sent (or, in test mode, would send) to players by WhatsApp/SMS. */
export default function MessagesPage() {
  const [data, setData] = useState<{ mode: 'mock' | 'live'; messages: OutboundMessage[] } | null>(null);

  useEffect(() => {
    getMessages().then(setData).catch(() => setData({ mode: 'live', messages: [] }));
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <BackButton />
      <PageHeader
        eyebrow="Club office"
        title="Messages"
        subtitle="WhatsApp and SMS sent to your players. Players with notifications on get a push instead."
      />

      {data?.mode === 'mock' && (
        <p className="mb-4 text-xs rounded-2xl bg-sky-300/30 border border-dashed border-sky-300 px-4 py-3 text-ink">
          <span className="font-bold">Test mode</span> — nothing is actually sent. Connect a WhatsApp/SMS provider (Termii) to go live.
        </p>
      )}

      {!data ? (
        <div className="space-y-2 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      ) : data.messages.length === 0 ? (
        <EmptyState icon="box" title="No messages yet" description="Receipts, game invites and vote reminders will show up here." />
      ) : (
        <div className="space-y-2">
          {data.messages.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-volt-300 text-ink">
                  {kindLabels[m.kind] ?? m.kind}
                </span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} · {m.to} ·{' '}
                  {new Date(m.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-ink whitespace-pre-line break-words">
                {m.kind === 'otp' ? m.body.replace(/^\d{6}/, '••••••') : m.body}
              </p>
              {m.status === 'failed' && <p className="text-xs font-bold text-kit-600 mt-2">Failed to send</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
