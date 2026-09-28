'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/brand';
import { NightStadium, OffsideFlag, Trophy } from '@/components/illustrations';
import { BallLoader } from '@/components/skeleton';
import { formatCurrency, getPublicGroup, joinGroup, type PublicGroup } from '@/lib/api';
import { formatAccountNumber, frequencyShort } from '@/lib/billing';

type Joined = PublicGroup & { paymentRef: string; firstName: string; alreadyMember: boolean };

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

function AccountCard({ group, reference }: { group: PublicGroup; reference?: string }) {
  const { copied, copy } = useCopy();
  if (!group.account) {
    return (
      <div className="rounded-3xl bg-chalk border border-gray-200 p-5 text-sm text-gray-600">
        Payment details will appear here once your organiser&apos;s group account is ready.
      </div>
    );
  }
  const a = group.account;
  return (
    <div className="relative rounded-[28px] bg-ink text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 turf-stripes" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">Pay into</p>
            <p className="text-sm font-semibold text-white/70 mt-1">{a.bankName}</p>
          </div>
          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-volt-400 text-ink tabular-nums whitespace-nowrap">
            {formatCurrency(group.feePerPlayer)} {frequencyShort(group.paymentType)}
          </span>
        </div>
        <button
          onClick={() => copy('acct', a.accountNumber)}
          className="group mt-4 flex items-center gap-3 text-left w-full"
        >
          <span className="font-display text-[30px] font-extrabold tracking-[0.06em] tabular-nums leading-none">
            {formatAccountNumber(a.accountNumber)}
          </span>
          <span className="ml-auto text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/10 group-hover:bg-volt-400 group-hover:text-ink transition-colors">
            {copied === 'acct' ? 'Copied!' : 'Copy'}
          </span>
        </button>
        <p className="text-sm text-white/60 mt-2">{a.accountName}</p>

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

export default function GroupLinkPage() {
  const { code } = useParams<{ code: string }>();
  const [group, setGroup] = useState<PublicGroup | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);

  useEffect(() => {
    getPublicGroup(code)
      .then(setGroup)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setFormError('First name, last name and phone are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await joinGroup(code, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
      setJoined(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(err.message || 'Could not join. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    'w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BallLoader label="Opening the dressing room…" />
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <OffsideFlag className="w-48 h-40 mx-auto mt-8 mb-2" />
          <h1 className="text-2xl font-extrabold text-ink mb-2">This link has expired</h1>
          <p className="text-sm text-gray-500">Ask your organiser for the latest group link.</p>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="w-full max-w-sm mx-auto">
          <div className="text-center">
            <Logo />
            <Trophy className="w-48 h-40 mx-auto mt-6" />
            <h1 className="text-3xl font-extrabold text-ink mt-1">
              {joined.alreadyMember ? `Welcome back, ${joined.firstName}!` : `You're in, ${joined.firstName}!`}
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              {joined.alreadyMember ? 'You’re already in' : 'You’ve joined'}{' '}
              <span className="font-bold text-ink">{joined.groupName}</span>. Here&apos;s how to pay.
            </p>
          </div>

          <div className="mt-6">
            <AccountCard group={joined} reference={joined.paymentRef} />
          </div>

          <ol className="mt-6 space-y-3">
            {[
              <>Transfer <span className="font-bold text-ink">{formatCurrency(joined.feePerPlayer)}</span> to the account above.</>,
              <>Put <span className="font-bold text-ink">{joined.paymentRef}</span> in the narration.</>,
              <>That&apos;s it — your organiser sees you as paid automatically.</>,
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                <span className="w-6 h-6 rounded-full bg-ink text-volt-300 text-xs font-extrabold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-gray-400 text-center">Save this page or screenshot it so you have your reference.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-6">
          <Logo />
        </div>

        <div className="relative h-40 rounded-3xl overflow-hidden bg-pitch-950 border-2 border-ink shadow-sticker">
          <NightStadium className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
          <div className="absolute left-4 right-4 bottom-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">
              {group.organizationName ? `${group.organizationName} invites you` : 'You’ve been called up'}
            </p>
            <h1 className="font-display text-[26px] font-extrabold text-white leading-tight">{group.groupName}</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 text-xs">
          {group.schedule && (
            <span className="px-2.5 py-1 rounded-full bg-chalk border border-gray-200 font-semibold text-gray-700">{group.schedule}</span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-chalk border border-gray-200 font-semibold text-gray-700 tabular-nums">
            {group.memberCount}/{group.targetPlayers} players
          </span>
          <span className="px-2.5 py-1 rounded-full bg-volt-300 border border-volt-400 font-bold text-ink tabular-nums">
            {formatCurrency(group.feePerPlayer)} {frequencyShort(group.paymentType)}
          </span>
        </div>
        {group.description && <p className="text-sm text-gray-600 mt-3">{group.description}</p>}

        <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-3xl border-2 border-ink shadow-sticker p-5 space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">Join the squad</h2>
            <p className="text-xs text-gray-500 mt-1">You&apos;ll get your personal payment reference straight after.</p>
          </div>

          {formError && (
            <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-bold text-gray-700 mb-1.5">First name *</label>
              <input id="firstName" name="firstName" required value={form.firstName} onChange={handleChange} className={input} />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-bold text-gray-700 mb-1.5">Last name *</label>
              <input id="lastName" name="lastName" required value={form.lastName} onChange={handleChange} className={input} />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-gray-700 mb-1.5">Phone number *</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              className={input}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-gray-700 mb-1.5">
              Email <span className="text-gray-400 font-medium">(optional)</span>
            </label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} className={input} />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Joining…' : 'Join & get payment details'}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-xs font-bold text-gray-500 mb-2 text-center">Already a member? Pay here</p>
          <AccountCard group={group} />
        </div>
      </div>
    </div>
  );
}
