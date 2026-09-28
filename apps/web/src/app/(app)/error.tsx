'use client';

import { ErrorView } from '@/components/error-view';

export default function AppError({
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
      homeHref="/dashboard"
      homeLabel="Dashboard"
      fullScreen={false}
    />
  );
}
