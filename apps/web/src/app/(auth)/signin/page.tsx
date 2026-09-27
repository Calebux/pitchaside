'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="text-2xl font-bold text-pitch-700">
          PitchAside
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-pitch-600 text-white text-sm font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-pitch-600 font-medium hover:text-pitch-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}
