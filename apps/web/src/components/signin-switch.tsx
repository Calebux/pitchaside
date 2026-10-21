import Link from 'next/link';

/**
 * Organiser or player: the two sign-ins are different accounts, so the switch sits at the top of
 * both pages (each side is its own page). The email typed so far goes along.
 */
export function SignInSwitch({ current, email }: { current: 'organiser' | 'player'; email?: string }) {
  const q = email?.trim() ? `?email=${encodeURIComponent(email.trim())}` : '';
  const sides = [
    { key: 'organiser', label: 'Organiser', href: `/signin${q}` },
    { key: 'player', label: 'Player', href: `/me/login${q}` },
  ] as const;
  return (
    <nav aria-label="Sign in as" className="flex p-1 bg-chalk rounded-2xl">
      {sides.map((s) => {
        const on = s.key === current;
        return (
          <Link
            key={s.key}
            href={s.href}
            replace
            aria-current={on ? 'page' : undefined}
            className={`press flex-1 min-h-11 px-3 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
              on ? 'bg-ink text-volt-300 shadow-card' : 'text-gray-600 hover:text-ink'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
