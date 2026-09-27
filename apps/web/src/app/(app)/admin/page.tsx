'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { http } from '@/lib/http';
import { StatCard } from '@/components/stat-card';
import { UserRole } from '@pitchaside/shared';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [orgStats, setOrgStats] = useState<any>(null);
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== UserRole.ORG_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      router.replace('/dashboard');
      return;
    }

    const promises: Promise<void>[] = [
      http.get<any>('/admin/org/stats').then(setOrgStats),
      http.get<any[]>('/admin/org/members').then(setOrgMembers),
    ];

    if (isSuperAdmin) {
      promises.push(http.get<any>('/admin/stats').then(setPlatformStats));
    }

    Promise.all(promises)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router, isSuperAdmin]);

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isSuperAdmin ? 'Platform administration' : 'Organization management'}
      </p>

      {/* Super Admin: Platform stats */}
      {isSuperAdmin && platformStats && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Platform Overview</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Organizations" value={platformStats.totalOrgs} />
            <StatCard label="Users" value={platformStats.totalUsers} />
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/organizations"
              className="flex-1 text-center py-2.5 px-4 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              All Organizations
            </Link>
            <Link
              href="/admin/users"
              className="flex-1 text-center py-2.5 px-4 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              All Users
            </Link>
          </div>
        </div>
      )}

      {/* Org Stats */}
      {orgStats && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            {user?.organization?.name || 'Organization'} Stats
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Groups" value={orgStats.totalGroups} />
            <StatCard label="Players" value={orgStats.totalPlayers} />
            <StatCard label="Sessions" value={orgStats.totalSessions} />
            <StatCard
              label="Collected"
              value={new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 0,
              }).format(orgStats.totalCollected)}
            />
          </div>
        </div>
      )}

      {/* Org Members */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Team Members</h2>
        <div className="space-y-2">
          {orgMembers.map((member: any) => (
            <div
              key={member.id}
              className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-pitch-100 text-pitch-700 flex items-center justify-center text-sm font-semibold">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                member.role === 'super_admin'
                  ? 'bg-purple-100 text-purple-700'
                  : member.role === 'org_admin'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {member.role === 'super_admin' ? 'Super Admin' : member.role === 'org_admin' ? 'Admin' : 'Member'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
