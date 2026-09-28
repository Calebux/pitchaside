'use client';

import { ErrorView } from '@/components/error-view';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      title="Something went wrong"
      message={error.message || 'An unexpected error occurred.'}
      onRetry={reset}
      homeHref="/"
      homeLabel="Go home"
    />
  );
}
