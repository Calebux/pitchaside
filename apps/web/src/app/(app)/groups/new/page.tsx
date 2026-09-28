'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { useToast } from '@/components/toast';
import { createGroup } from '@/lib/api';
import { PaymentType } from '@pitchaside/shared';

type Errors = Record<string, string>;

function validate(form: FormData): Errors | null {
  const errors: Errors = {};
  const name = (form.get('name') as string).trim();
  const targetPlayers = Number(form.get('targetPlayers'));
  const feePerPlayer = Number(form.get('feePerPlayer'));

  if (!name) errors.name = 'Group name is required';
  else if (name.length < 2) errors.name = 'Name must be at least 2 characters';

  if (!targetPlayers || targetPlayers < 1) errors.targetPlayers = 'Must have at least 1 player';

  if (isNaN(feePerPlayer) || feePerPlayer < 0) errors.feePerPlayer = 'Fee cannot be negative';

  return Object.keys(errors).length ? errors : null;
}

export default function NewGroupPage() {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const validationErrors = validate(form);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const group = await createGroup({
        name: (form.get('name') as string).trim(),
        description: (form.get('description') as string) || undefined,
        schedule: (form.get('schedule') as string) || undefined,
        targetPlayers: Number(form.get('targetPlayers')),
        feePerPlayer: Number(form.get('feePerPlayer')),
        paymentType: form.get('paymentType') as PaymentType,
      });
      router.push(`/groups/${group.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent ${
      errors[field] ? 'border-red-400' : 'border-gray-200'
    }`;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Groups" />
      <h1 className="text-xl font-bold text-gray-900 mb-6">New Group</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-gray-500 mb-1.5">
            Group Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g. Sunday League"
            className={inputClass('name')}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium text-gray-500 mb-1.5">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            placeholder="Optional description"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label htmlFor="schedule" className="block text-xs font-medium text-gray-500 mb-1.5">
            Schedule
          </label>
          <input
            id="schedule"
            name="schedule"
            type="text"
            placeholder="e.g. Every Sunday 4pm"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="targetPlayers" className="block text-xs font-medium text-gray-500 mb-1.5">
              Target Players *
            </label>
            <input
              id="targetPlayers"
              name="targetPlayers"
              type="number"
              min={1}
              defaultValue={10}
              className={inputClass('targetPlayers')}
            />
            {errors.targetPlayers && <p className="text-xs text-red-600 mt-1">{errors.targetPlayers}</p>}
          </div>
          <div>
            <label htmlFor="feePerPlayer" className="block text-xs font-medium text-gray-500 mb-1.5">
              Fee per Player *
            </label>
            <input
              id="feePerPlayer"
              name="feePerPlayer"
              type="number"
              min={0}
              step="0.01"
              defaultValue={10}
              className={inputClass('feePerPlayer')}
            />
            {errors.feePerPlayer && <p className="text-xs text-red-600 mt-1">{errors.feePerPlayer}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="paymentType" className="block text-xs font-medium text-gray-500 mb-1.5">
            Payment Type
          </label>
          <select
            id="paymentType"
            name="paymentType"
            defaultValue={PaymentType.PER_SESSION}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent bg-white"
          >
            <option value={PaymentType.PER_SESSION}>Per Session</option>
            <option value={PaymentType.MONTHLY}>Monthly</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pitch-600 text-white font-semibold rounded-xl hover:bg-pitch-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </div>
  );
}
