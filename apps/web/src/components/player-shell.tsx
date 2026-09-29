'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/brand';
import { BallLoader } from '@/components/skeleton';
import { getPlayerProfile, getPlayerToken, PlayerAuthError, type PlayerProfile } from '@/lib/player';

const ProfileContext = createContext<{ profile: PlayerProfile | null; refresh: () => Promise<void> }>({
  profile: null,
  refresh: async () => {},
});

export const usePlayerProfile = () => useContext(ProfileContext);

const tabs = [
  {
    href: '/me',
    label: 'Home',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />,
  },
  {
    href: '/me/games',
    label: 'Games',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />,
  },
  {
    href: '/me/pay',
    label: 'Pay',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />,
  },
  {
    href: '/me/profile',
    label: 'Me',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />,
  },
];

/** Playing ⇄ Organising. Organising needs the organiser's email + password (it handles money). */
export function ModeSwitch({ organiser }: { organiser: PlayerProfile['organiser'] }) {
  const router = useRouter();
  if (!organiser) return null;
  const goOrganise = () => {
    let signedIn = false;
    try {
      signedIn = !!localStorage.getItem('pitchaside_token');
    } catch {
      /* ignore */
    }
    router.push(signedIn ? '/dashboard' : `/signin?email=${encodeURIComponent(organiser.email)}`);
  };
  return (
    <div className="flex items-center rounded-full bg-chalk border border-gray-200 p-0.5 text-[11px] font-bold" role="tablist" aria-label="Mode">
      <span className="px-2.5 py-1 rounded-full bg-ink text-volt-300" role="tab" aria-selected>
        Playing
      </span>
      <button onClick={goOrganise} className="px-2.5 py-1 rounded-full text-gray-600 hover:text-ink" role="tab" aria-selected={false}>
        Organising
      </button>
    </div>
  );
}

/** Player app frame: header with mode switch, content, floating tab bar. */
export function PlayerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  const refresh = async () => {
    try {
      setProfile(await getPlayerProfile());
    } catch (err) {
      if (err instanceof PlayerAuthError) router.replace('/me/login');
    }
  };

  useEffect(() => {
    if (!getPlayerToken()) {
      router.replace('/me/login');
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BallLoader label="Loading your season…" />
      </div>
    );
  }

  return (
    <ProfileContext.Provider value={{ profile, refresh }}>
      <div className="min-h-screen pb-28">
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-ink/5">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Logo href="/me" size="sm" />
            <ModeSwitch organiser={profile.organiser} />
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 pt-5">{children}</main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto flex justify-around items-center bg-ink/95 backdrop-blur-xl rounded-[22px] px-1.5 py-1.5 shadow-lift">
          {tabs.map((t) => {
            const active = t.href === '/me' ? pathname === '/me' : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center justify-center rounded-2xl h-12 flex-1 transition-all ${
                  active ? 'bg-volt-400 text-ink' : 'text-white/55'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.6} stroke="currentColor" aria-hidden>
                  {t.icon}
                </svg>
                <span className={`text-[10px] mt-0.5 ${active ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </ProfileContext.Provider>
  );
}
