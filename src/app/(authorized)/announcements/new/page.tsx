'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewsForm } from '../NewsForm';
import { useAuth } from '@/context/AuthContext';
import { StateCard } from '@/components/chrome/StateCard';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';

export default function NewAnnouncementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [pending, setPending] = useState(false);

  if (!privileged) {
    return (
      <StateCard
        title="Duyurular yalnızca YK ve kurul içindir."
        description="Bu ekran yayın yetkisi ister."
        Icon={ShieldAlert}
        tone="warning"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni duyuru" />
      <NewsForm
        submitLabel="Yayınla"
        pending={pending}
        onSubmit={async (data) => {
          setPending(true);
          try {
            await newsApi.create(data);
            router.push('/announcements');
          } catch (err) {
            throw err instanceof ProblemError ? err : new Error('Oluşturulamadı');
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
