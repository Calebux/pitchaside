'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { http } from '@/lib/http';
import { BackButton } from '@/components/back-button';
import { UserRole } from '@pitchaside/shared';

export default function AdminOrganizationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== UserRole.SUPER_ADMIN) {
      router.replace('/admin');
      return;
    }

    http
      .get<any[]>('/admin/organizations')
      .then(setOrgs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Organizations</h1>
      <p className="text-sm text-gray-500 mb-6">All organizations on the platform</p>

      <div className="space-y-3">
        {orgs.map((org) => (
          <div
            key={org.id}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{org.users?.length || 0} users</p>
                <p>{org.groups?.length || 0} groups</p>
              </div>
            </div>
          </div>
        ))}

        {orgs.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No organizations yet.</p>
        )}
      </div>
    </div>
  );
}
