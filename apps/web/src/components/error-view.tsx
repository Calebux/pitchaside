'use client';

import Link from 'next/link';
import { OffsideFlag } from '@/components/illustrations';

/** Shared "flag's up" screen for error boundaries and 404s. */
export function ErrorView({
  eyebrow = 'Flag’s up',
  title,
  message,
  onRetry,
  homeHref,
  homeLabel,
  fullScreen = true,
}: {
  eyebrow?: string;
  title: string;
  message: string;
  onRetry?: () => void;
  homeHref: string;
  homeLabel: string;
  fullScreen?: boolean;
}) {
  return (
    <div className={`${fullScreen ? 'min-h-screen' : 'py-16'} flex items-center justify-center px-4`}>
      <div className="text-center max-w-sm animate-fade-in-up">
        <div className="w-52 h-44 mx-auto mb-2 rounded-[32px] bg-white border border-gray-100 shadow-card flex items-center justify-center chalk-dots">
          <OffsideFlag className="w-44 h-36" />
        </div>
        <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-kit-600">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">{title}</h1>
        <p className="text-sm text-gray-500 mt-2 mb-7">{message}</p>
        <div className="flex items-center justify-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors"
            >
              Try again
            </button>
          )}
          <Link
            href={homeHref}
            className={`px-6 py-3 text-sm font-bold rounded-xl transition-colors ${
              onRetry ? 'text-ink bg-white border border-gray-200 hover:border-ink' : 'bg-ink text-volt-300 hover:bg-pitch-900'
            }`}
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
