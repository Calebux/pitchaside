'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { useToast } from '@/components/toast';
import { createPlayer } from '@/lib/api';

type Errors = Record<string, string>;

function validate(form: FormData): Errors | null {
  const errors: Errors = {};
  const firstName = (form.get('firstName') as string).trim();
  const lastName = (form.get('lastName') as string).trim();
  const phone = (form.get('phone') as string).trim();
  const email = (form.get('email') as string).trim();

  if (!firstName) errors.firstName = 'First name is required';
  else if (firstName.length < 2) errors.firstName = 'Must be at least 2 characters';

  if (!lastName) errors.lastName = 'Last name is required';
  else if (lastName.length < 2) errors.lastName = 'Must be at least 2 characters';

  if (!phone) errors.phone = 'Phone is required';
  else if (!/^[+\d]/.test(phone) || phone.length < 7) errors.phone = 'Enter a valid phone number (min 7 characters)';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';

  return Object.keys(errors).length ? errors : null;
}

export default function NewPlayerPage() {
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
      await createPlayer({
        firstName: (form.get('firstName') as string).trim(),
        lastName: (form.get('lastName') as string).trim(),
        phone: (form.get('phone') as string).trim(),
        email: (form.get('email') as string).trim() || undefined,
      });
      router.push('/players');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to register player');
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent ${
      errors[field] ? 'border-red-400' : 'border-gray-200'
    }`;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton label="Players" />
      <h1 className="text-xl font-bold text-gray-900 mb-6">Register Player</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-xs font-medium text-gray-500 mb-1.5">
              First Name *
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              className={inputClass('firstName')}
            />
            {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-xs font-medium text-gray-500 mb-1.5">
              Last Name *
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              className={inputClass('lastName')}
            />
            {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-xs font-medium text-gray-500 mb-1.5">
            Phone *
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+234..."
            className={inputClass('phone')}
          />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Optional"
            className={inputClass('email')}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pitch-600 text-white font-semibold rounded-xl hover:bg-pitch-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Registering...' : 'Register Player'}
        </button>
      </form>
    </div>
  );
}
