'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getGroups, getSessions, formatCurrency, type IGroupWithMembers, type ISessionWithDetails } from '@/lib/api';
import { SessionStatus } from '@pitchaside/shared';

const onboardingSteps = [
  {
    step: 1,
    title: 'Create your first group',
    description: 'Set up a pitch group with your team name, player fee, and target size.',
    href: '/groups/new',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    step: 2,
    title: 'Add players',
    description: 'Add the regulars so you can track who\'s paid and who hasn\'t.',
    href: '/players/new',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
      </svg>
    ),
  },
  {
    step: 3,
    title: 'Schedule a session',
    description: 'Create a match session and payments are auto-generated for each player.',
    href: '/sessions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<IGroupWithMembers[]>([]);
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGroups(), getSessions()])
      .then(([g, s]) => {
        setGroups(g);
        setSessions(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcomingSessions = sessions
    .filter((s) => s.status === SessionStatus.UPCOMING)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextSession = upcomingSessions[0];
  const nextGroup = nextSession ? groups.find((g) => g.id === nextSession.groupId) : null;

  const totalTarget = sessions.reduce((sum, s) => sum + s.targetAmount, 0);
  const totalCollected = sessions.reduce((sum, s) => sum + s.collectedAmount, 0);

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-3 bg-gray-100 rounded w-28" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
          </div>
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  // New user — no groups yet
  if (groups.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="pt-8 pb-6 text-center">
          <div className="w-14 h-14 bg-pitch-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-pitch-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
          </h1>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Let&apos;s get your pitch set up. Follow these steps to start tracking payments.
          </p>
        </div>

        <div className="space-y-2">
          {onboardingSteps.map((item) => (
            <Link
              key={item.step}
              href={item.href}
              className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-100 hover:border-pitch-200 transition-all"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-pitch-50 text-pitch-600 flex items-center justify-center">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/groups/new"
            className="inline-block px-6 py-2.5 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  const nextProgress = nextSession && nextSession.targetAmount > 0
    ? Math.round((nextSession.collectedAmount / nextSession.targetAmount) * 100)
    : 0;
  const nextPaidCount = nextSession?.payments?.filter((p) => p.status === 'paid').length ?? 0;
  const nextTotalCount = nextSession?.payments?.length ?? 0;
  const nextPendingCount = nextTotalCount - nextPaidCount;

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5">
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-xl font-bold text-gray-900">
          Hi, {user?.firstName || 'there'}
        </h1>
      </div>

      {/* Next Game Card — the hero section */}
      {nextSession ? (
        <Link
          href={`/sessions/${nextSession.id}`}
          className="block bg-gray-900 rounded-2xl p-5 mb-4 text-white relative overflow-hidden"
        >
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Next Game</p>
                <p className="text-base font-bold mt-0.5">{nextGroup?.name || 'Game'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  {new Date(nextSession.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Payment progress */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold tabular-nums">
                  {formatCurrency(nextSession.collectedAmount)}
                </span>
                <span className="text-sm text-gray-400 tabular-nums">
                  of {formatCurrency(nextSession.targetAmount)}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-pitch-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(nextProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-pitch-400" />
                <span className="text-xs text-gray-300">
                  <span className="font-semibold text-white tabular-nums">{nextPaidCount}</span> paid
                </span>
              </div>
              {nextPendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs text-gray-300">
                    <span className="font-semibold text-white tabular-nums">{nextPendingCount}</span> pending
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs font-semibold text-pitch-400 tabular-nums">{nextProgress}%</span>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center mb-4">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">No upcoming sessions</p>
          <p className="text-xs text-gray-500">Create a session from a group to get started.</p>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Groups</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{groups.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Upcoming</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{upcomingSessions.length}</p>
        </div>
      </div>

      {totalTarget > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Collected</p>
            <p className="text-xs font-semibold text-pitch-600 tabular-nums">
              {totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0}%
            </p>
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(totalCollected)}</p>
          <p className="text-xs text-gray-400 mt-0.5 tabular-nums">of {formatCurrency(totalTarget)} expected</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
            <div
              className="bg-pitch-500 h-1.5 rounded-full transition-all"
              style={{ width: `${totalTarget > 0 ? Math.min(Math.round((totalCollected / totalTarget) * 100), 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/groups/new"
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Group
        </Link>
        <Link
          href="/players"
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          Players
        </Link>
      </div>

      {/* Other Upcoming Sessions */}
      {upcomingSessions.length > 1 && (
        <>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Other Upcoming Sessions</h2>
          <div className="space-y-2">
            {upcomingSessions.slice(1, 5).map((session) => {
              const progress = session.targetAmount > 0
                ? Math.round((session.collectedAmount / session.targetAmount) * 100)
                : 0;
              const group = groups.find((g) => g.id === session.groupId);

              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center gap-4 bg-white rounded-xl p-3.5 border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-600">
                      {new Date(session.date).toLocaleDateString('en-US', { day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {group?.name || 'Game'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(session.collectedAmount)}
                    </p>
                    <p className="text-[10px] text-gray-400 tabular-nums">{progress}%</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
