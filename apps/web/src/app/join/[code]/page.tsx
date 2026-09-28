'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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

  const inputClass = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pitch-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-pitch-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PitchAside</span>
          </Link>
          <div className="mt-8">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid Invite Link</h1>
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
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-pitch-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PitchAside</span>
          </Link>
          <div className="mt-8">
            <div className="w-14 h-14 bg-pitch-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-pitch-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">You&apos;re in!</h1>
            <p className="text-sm text-gray-500">
              You&apos;ve been added to <span className="font-semibold text-gray-900">{orgName}</span>. The organizer will see you in their player list.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-pitch-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PitchAside</span>
          </Link>
          <h1 className="mt-6 text-xl font-bold text-gray-900">
            Join {orgName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Register as a player
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-gray-500 mb-1.5">
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
              <label htmlFor="lastName" className="block text-xs font-medium text-gray-500 mb-1.5">
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
            <label htmlFor="phone" className="block text-xs font-medium text-gray-500 mb-1.5">
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
            <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5">
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
            className="w-full py-3 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Joining...' : 'Join Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
