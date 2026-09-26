'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { createGroup } from '@/lib/api';
import { PaymentType } from '@pitchaside/shared';

export default function NewGroupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const form = new FormData(e.currentTarget);

    try {
      const group = await createGroup({
        name: form.get('name') as string,
        description: (form.get('description') as string) || undefined,
        schedule: (form.get('schedule') as string) || undefined,
        targetPlayers: Number(form.get('targetPlayers')),
        feePerPlayer: Number(form.get('feePerPlayer')),
        paymentType: form.get('paymentType') as PaymentType,
      });
      router.push(`/groups/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Groups" />
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Group</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Group Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Sunday League"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            placeholder="Optional description"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-1">
            Schedule
          </label>
          <input
            id="schedule"
            name="schedule"
            type="text"
            placeholder="e.g. Every Sunday 4pm"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="targetPlayers" className="block text-sm font-medium text-gray-700 mb-1">
              Target Players *
            </label>
            <input
              id="targetPlayers"
              name="targetPlayers"
              type="number"
              min={1}
              required
              defaultValue={10}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="feePerPlayer" className="block text-sm font-medium text-gray-700 mb-1">
              Fee per Player *
            </label>
            <input
              id="feePerPlayer"
              name="feePerPlayer"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={10}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="paymentType" className="block text-sm font-medium text-gray-700 mb-1">
            Payment Type
          </label>
          <select
            id="paymentType"
            name="paymentType"
            defaultValue={PaymentType.PER_SESSION}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent bg-white"
          >
            <option value={PaymentType.PER_SESSION}>Per Session</option>
            <option value={PaymentType.MONTHLY}>Monthly</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pitch-600 text-white font-medium rounded-lg hover:bg-pitch-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </div>
  );
}
