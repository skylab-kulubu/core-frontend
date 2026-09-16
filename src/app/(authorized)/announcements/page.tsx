'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, type NewsItem } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';

const PAGE_SIZE = 10;

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!privileged) return;
    newsApi
      .list({ limit: 100 })
      .then((result) => {
        setItems((result.items ?? []).filter((item) => Boolean(item.slug)));
        setError(null);
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Duyurular yüklenemedi'));
  }, [privileged]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  if (!privileged) {
    return <p className="text-sm text-red-300">Duyurular yalnızca Privileged gruplar içindir.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duyurular"
        description="CMS News. Yayınlamak Privileged gruplara aittir."
        actions={
          <ActionButton
            href="/announcements/new"
            icon={Plus}
            variant="primary"
            label="Yeni duyuru"
          />
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {slice.map((item) => (
          <ListItem
            key={item.slug}
            href={`/announcements/${encodeURIComponent(item.slug)}/edit`}
            title={item.data?.title || item.slug}
            subtitle={item.data?.summary || item.slug}
          />
        ))}
      </div>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
