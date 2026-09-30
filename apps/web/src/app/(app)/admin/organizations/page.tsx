'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { http } from '@/lib/http';
import { BackButton } from '@/components/back-button';
import { UserRole } from '@pitchaside/shared';
import { PageHeader } from '@/components/brand';

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
      .get<any>('/admin/organizations')
      .then((res) => setOrgs(res.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <BackButton />
      <PageHeader eyebrow="Platform" title="Organizations" subtitle="All organizations on the platform" />

      <div className="space-y-2">
        {orgs.map((org) => (
          <div
            key={org.id}
            className="bg-white rounded-2xl shadow-card p-4 border border-gray-100"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500 tabular-nums">
                <p>{org.users?.length || 0} users</p>
                <p>{org.groups?.length || 0} groups</p>
              </div>
            </div>
          </div>
        ))}

        {orgs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">No organizations yet.</p>
        )}
      </div>
    </div>
  );
}
