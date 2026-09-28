import { BallIcon } from '@/components/illustrations';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 bg-gray-200 rounded-xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-4">
      <div className="h-6 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-100 rounded w-1/2" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-100 rounded" />
        <div className="h-4 bg-gray-100 rounded w-5/6" />
        <div className="h-4 bg-gray-100 rounded w-4/6" />
      </div>
    </div>
  );
}

/** The matchday ball, spinning — our loading indicator at any size. */
export function BallSpinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <BallIcon className={`${className} animate-spin-ball`} />;
}

/** Full-page loading state: the spinning ball with its shadow. */
export function BallLoader({ label = 'Warming up…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2" role="status">
      <BallSpinner className="w-12 h-12" />
      <div className="w-9 h-1.5 rounded-full bg-ink/15" />
      <p className="text-xs font-semibold text-gray-500 mt-2">{label}</p>
    </div>
  );
}
