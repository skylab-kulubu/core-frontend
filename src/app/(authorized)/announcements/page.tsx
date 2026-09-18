'use client';

import { useEffect, useMemo, useState } from 'react';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { StatusChip } from '@/components/chrome/StatusChip';
import { StateCard } from '@/components/chrome/StateCard';
import { Plus, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, type NewsItem } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState<'all' | 'featured'>('all');

  useEffect(() => {
    if (!privileged) {
      setLoading(false);
      return;
    }
    newsApi
      .list({ limit: 100 })
      .then((result) => {
        setItems((result.items ?? []).filter((item) => Boolean(item.slug)));
        setError(null);
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Duyurular yüklenemedi'))
      .finally(() => setLoading(false));
  }, [privileged]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (featuredOnly === 'featured' && !item.data?.featured) return false;
      return matchesQuery(query, item.data?.title, item.data?.summary, item.slug);
    });
  }, [items, query, featuredOnly]);
  const paged = paginateRows(filtered, page);

  useEffect(() => {
    setPage(1);
  }, [query, featuredOnly]);

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
      <PageHeader
        title="Duyurular"
        description="Site duyuruları. Yayınlamak YK ve kurul içindir."
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
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Başlık veya özet"
        searchLabel="Duyuru ara"
      >
        <FilterPills
          ariaLabel="Duyuru dilimi"
          value={featuredOnly}
          onChange={setFeaturedOnly}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'featured', label: 'Öne çıkan' },
          ]}
        />
      </ListToolbar>
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Duyuru yok',
            noneMatch: 'Eşleşen duyuru yok',
            query,
            filtered: featuredOnly !== 'all',
          }),
        })}
        emptyDescription="Yeni duyuru yaz veya filtreyi temizle."
      >
        {paged.slice.map((item) => (
          <ListItem
            key={item.slug}
            href={`/announcements/${encodeURIComponent(item.slug)}/edit`}
            title={item.data?.title || item.slug}
            subtitle={item.data?.summary || item.slug}
            trailing={item.data?.featured ? <StatusChip kind="featured" /> : undefined}
          />
        ))}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
    </div>
  );
}
