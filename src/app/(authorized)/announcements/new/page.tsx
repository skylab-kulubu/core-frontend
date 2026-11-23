'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NewsEditor } from '@/components/announcements/NewsEditor';
import { Forbidden } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, pendingNewsDraft, type NewsData } from '@/lib/api/cms';
import { useNotify } from '@/lib/ui/use-notify';

export default function NewAnnouncementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const notify = useNotify();
  // The writer's own draft of a new announcement, kept by the CMS; undefined while read
  const [draft, setDraft] = useState<Partial<NewsData> | null | undefined>(undefined);

  useEffect(() => {
    if (!privileged) return;
    let cancelled = false;
    newsApi
      .list({ limit: 1 })
      .then((page) => {
        if (!cancelled) setDraft(pendingNewsDraft(page)?.draftData ?? null);
      })
      // No draft to resume is no reason to keep the writer out
      .catch(() => {
        if (!cancelled) setDraft(null);
      });
    return () => {
      cancelled = true;
    };
  }, [privileged]);

  if (!privileged) return <Forbidden pageTitle="Yeni duyuru" />;
  if (draft === undefined) return <PageSkeleton variant="detail" />;

  return (
    <div className="space-y-4">
      <PageHeader title="Yeni duyuru" />
      <NewsEditor
        source={{ kind: 'new', draft }}
        onPublished={(item) => {
          notify.success('Duyuru yayınlandı');
          router.push(
            item?.slug ? `/announcements/${encodeURIComponent(item.slug)}/edit` : '/announcements',
          );
        }}
      />
    </div>
  );
}
