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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pitch-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="text-2xl font-bold text-pitch-700">
            PitchAside
          </Link>
          <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">Invalid Invite Link</h1>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="text-2xl font-bold text-pitch-700">
            PitchAside
          </Link>
          <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">You&apos;re in!</h1>
            <p className="text-sm text-gray-500">
              You&apos;ve been added to <span className="font-medium text-gray-700">{orgName}</span>. The organizer will see you in their player list.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-pitch-700">
            PitchAside
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Join {orgName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Register as a player
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              value={form.firstName}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              placeholder="John"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              value={form.lastName}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              placeholder="Doe"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              placeholder="+234 800 000 0000"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Joining...' : 'Join Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
