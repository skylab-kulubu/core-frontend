'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewsForm } from '../NewsForm';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, newsProblemMessage } from '@/lib/api/cms';
import { useNotify } from '@/lib/ui/use-notify';
import { Forbidden } from '@/components/chrome/PageState';

export default function NewAnnouncementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [pending, setPending] = useState(false);
  const notify = useNotify();

  if (!privileged) return <Forbidden pageTitle="Yeni duyuru" />;

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
            notify.success('Duyuru yayınlandı');
            router.push('/announcements');
          } catch (err) {
            throw new Error(newsProblemMessage(err, 'Oluşturulamadı'));
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
