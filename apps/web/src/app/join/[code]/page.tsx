'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/brand';
import { OffsideFlag, Trophy, NightStadium } from '@/components/illustrations';
import { BallLoader } from '@/components/skeleton';
import { getOrgByInviteCode, joinOrg } from '@/lib/api';

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [orgName, setOrgName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getOrgByInviteCode(code)
      .then((res) => setOrgName(res.organizationName))
      .catch(() => setError('Invalid or expired invite link'))
      .finally(() => setLoading(false));
  }, [code]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setFormError('First name, last name, and phone are required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await joinOrg(code, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to join. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-volt-300/70 focus:border-pitch-600";

  if (loading) {
    return (
      <div className="min-h-screen bg-chalk flex items-center justify-center px-4">
        <BallLoader label="Checking your invite…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-chalk flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <div className="mt-8">
            <OffsideFlag className="w-48 h-40 mx-auto mb-2" />
            <h1 className="text-2xl font-extrabold text-ink mb-2">Invalid invite link</h1>
            <p className="text-sm text-gray-500">
              This invite link is invalid or has expired. Please ask your organizer for a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-chalk flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Logo />
          <div className="mt-8">
            <Trophy className="w-52 h-44 mx-auto mb-2" />
            <h1 className="text-3xl font-extrabold text-ink mb-2">You&apos;re in the squad!</h1>
            <p className="text-sm text-gray-500">
              You&apos;ve been added to <span className="font-bold text-ink">{orgName}</span>. The organizer will see you in their player list.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chalk flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Logo />
        </div>
        <div className="relative h-36 rounded-3xl overflow-hidden bg-pitch-950 border-2 border-ink shadow-sticker mb-6">
          <NightStadium className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
          <div className="absolute left-4 right-4 bottom-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-volt-300">You&apos;ve been called up</p>
            <h1 className="font-display text-2xl font-extrabold text-white leading-tight truncate">Join {orgName}</h1>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5 text-center">
          Register as a player so your organiser can track your games and payments.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-kit-400/10 border border-kit-400/40 text-kit-600 text-sm rounded-xl px-4 py-3">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-bold text-gray-700 mb-1.5">
                First Name *
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={form.firstName}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-bold text-gray-700 mb-1.5">
                Last Name *
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={form.lastName}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-gray-700 mb-1.5">
              Phone Number *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
              placeholder="+234 800 000 0000"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-gray-700 mb-1.5">
              Email <span className="text-gray-300">(optional)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className={inputClass}
              placeholder="john@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Joining...' : 'Join Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
