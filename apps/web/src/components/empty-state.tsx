import Link from 'next/link';
import { EmptyGoal, KitLine, TacticsBoard, KittyJar } from '@/components/illustrations';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: 'box' | 'users' | 'calendar' | 'receipt';
}

const art = {
  box: EmptyGoal,
  users: KitLine,
  calendar: TacticsBoard,
  receipt: KittyJar,
};

export function EmptyState({ title, description, actionLabel, actionHref, icon = 'box' }: EmptyStateProps) {
  const Art = art[icon];
  return (
    <div className="text-center py-10 px-6 bg-white rounded-3xl border border-dashed border-gray-300 chalk-dots">
      <Art className="w-44 h-32 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 bg-ink text-volt-300 text-sm font-bold rounded-xl hover:bg-pitch-900 transition-colors"
        >
          {actionLabel}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
