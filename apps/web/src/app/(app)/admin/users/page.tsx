'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { http } from '@/lib/http';
import { BackButton } from '@/components/back-button';
import { UserRole } from '@pitchaside/shared';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== UserRole.SUPER_ADMIN) {
      router.replace('/admin');
      return;
    }

    http
      .get<any[]>('/admin/users')
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="h-6 bg-gray-200 rounded w-32" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton />
      <h1 className="text-xl font-bold text-gray-900 mb-1">Users</h1>
      <p className="text-xs text-gray-400 mb-6">All users across the platform</p>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-white rounded-xl p-3.5 border border-gray-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold">
                {u.firstName[0]}{u.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-xs text-gray-400">{u.email}</p>
                <p className="text-xs text-gray-300">{u.organization?.name}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${
                u.role === 'super_admin'
                  ? 'bg-purple-50 text-purple-700'
                  : u.role === 'org_admin'
                    ? 'bg-pitch-50 text-pitch-700'
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {u.role === 'super_admin' ? 'Super Admin' : u.role === 'org_admin' ? 'Admin' : 'Member'}
              </span>
              <p className="text-xs text-gray-300 mt-1">
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">No users found.</p>
        )}
      </div>
    </div>
  );
}
