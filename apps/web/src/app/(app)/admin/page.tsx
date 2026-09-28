'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { http } from '@/lib/http';
import { StatCard } from '@/components/stat-card';
import { UserRole } from '@pitchaside/shared';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [orgStats, setOrgStats] = useState<any>(null);
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== UserRole.ORG_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      router.replace('/dashboard');
      return;
    }

    const promises: Promise<void>[] = [
      http.get<any>('/admin/org/stats').then(setOrgStats),
      http.get<any[]>('/admin/org/members').then(setOrgMembers),
      http.get<any>('/admin/org/audit-log?limit=10').then((res) => setAuditLogs(res.data || [])),
    ];

    if (isSuperAdmin) {
      promises.push(http.get<any>('/admin/stats').then(setPlatformStats));
    }

    Promise.all(promises)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router, isSuperAdmin]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const newMember = await http.post<any>('/admin/org/members', inviteForm);
      setOrgMembers((prev) => [...prev, newMember]);
      setInviteForm({ firstName: '', lastName: '', email: '', password: '' });
      setShowInvite(false);
      toast.success('Member added successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setInviting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent";

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-24" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-20 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Admin</h1>
      <p className="text-xs text-gray-400 mb-6">
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
              className="flex-1 text-center py-2.5 px-4 text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              All Organizations
            </Link>
            <Link
              href="/admin/users"
              className="flex-1 text-center py-2.5 px-4 text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
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
            {user?.organization?.name || 'Organization'}
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

      {/* Recent Activity */}
      {auditLogs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {auditLogs.map((log: any) => (
              <div
                key={log.id}
                className="bg-white rounded-xl p-3.5 border border-gray-100 text-sm"
              >
                <div className="flex justify-between items-start">
                  <p className="text-gray-900 font-medium capitalize">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {log.entityType} &middot; {log.entityId?.slice(0, 8)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org Members */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="text-sm font-semibold text-pitch-600 hover:text-pitch-700"
          >
            {showInvite ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <form onSubmit={handleInvite} className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First name"
                required
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Last name"
                required
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                className={inputClass}
              />
            </div>
            <input
              type="email"
              placeholder="Email address"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Temporary password"
              required
              minLength={6}
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={inviting}
              className="w-full py-2.5 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 transition-colors disabled:opacity-50"
            >
              {inviting ? 'Adding...' : 'Add Member'}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {orgMembers.map((member: any) => (
            <div
              key={member.id}
              className="bg-white rounded-xl p-3.5 border border-gray-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{member.email}</p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${
                member.role === 'super_admin'
                  ? 'bg-purple-50 text-purple-700'
                  : member.role === 'org_admin'
                    ? 'bg-pitch-50 text-pitch-700'
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {member.role === 'super_admin' ? 'Super Admin' : member.role === 'org_admin' ? 'Admin' : 'Member'}
              </span>
            </div>
          ))}

          {orgMembers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No team members yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
