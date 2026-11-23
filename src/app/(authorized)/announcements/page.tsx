'use client';

import { Badge, DataList, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { ImageIcon, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnPicker, useColumnChoice, type ColumnChoice } from '@/components/chrome/ColumnPicker';
import { ListFooter, ListPage, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import { ActionButton } from '@/components/chrome/ActionButton';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, type NewsItem } from '@/lib/api/cms';
import { coreProblemMessage } from '@/lib/core-problems';
import { publicMediaUrl } from '@/lib/event-media';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { useListParams } from '@/lib/ui/use-list-params';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const PAGE_SIZE = 50;
type View = 'all' | 'featured';

const COLUMNS: readonly ColumnChoice[] = [
  { id: 'title', label: 'Başlık', fixed: true },
  { id: 'author', label: 'Yazar' },
  { id: 'tags', label: 'Etiketler' },
  { id: 'featured', label: 'Öne çıkan', fixed: true },
];

/** The cover at a glance, uncropped; a placeholder when there is none. */
function Cover({ src }: { src?: string }) {
  const url = src?.trim() ? publicMediaUrl(src) : '';
  return (
    <span className="bg-muted border-border-subtle grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-md border">
      {url ? (
        <img src={url} alt="" className="size-full object-contain" />
      ) : (
        <ImageIcon className="text-subtle-foreground size-4" aria-hidden />
      )}
    </span>
  );
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [params, setParams] = useListParams({ view: 'all' });
  const view: View = params.view === 'featured' ? 'featured' : 'all';
  const columns = useColumnChoice('skylab.admin.columns.announcements', COLUMNS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await newsApi.list({ limit: 100 });
      setItems((result.items ?? []).filter((item) => Boolean(item.slug)));
      setFailed(null);
    } catch (error) {
      // inscribed's reason in Turkish (no access, maintenance), never its English detail
      setFailed(coreProblemMessage(error, 'Duyurular yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!privileged) {
      setLoading(false);
      return;
    }
    void load();
  }, [privileged, load]);

  const searched = useMemo(
    () =>
      items.filter((item) =>
        matchesQuery(params.q, item.data?.title, item.data?.summary, item.data?.author, item.slug),
      ),
    [items, params.q],
  );
  const featuredCount = searched.filter((item) => item.data?.featured).length;
  const rows = view === 'featured' ? searched.filter((item) => item.data?.featured) : searched;
  const paged = paginateRows(rows, params.page, PAGE_SIZE);
  const filtered = Boolean(params.q.trim()) || view !== 'all';

  if (!privileged) return <Forbidden pageTitle="Duyurular" />;

  const listColumns: DataListColumn<NewsItem>[] = [
    {
      id: 'title',
      width: 'minmax(0,1fr)',
      header: 'Başlık',
      cell: (item) => (
        <DataListTitle
          leading={<Cover src={item.data?.heroImage} />}
          title={item.data?.title || item.slug}
          // 13px: skylcn-ui's DataListTitle writes its line at 10px
          subtitle={
            item.data?.summary ? (
              <span className={TEXT_SECONDARY}>{item.data.summary}</span>
            ) : undefined
          }
        />
      ),
    },
    ...(columns.isShown('author')
      ? [
          {
            id: 'author',
            width: '10rem',
            from: 'md' as const,
            header: 'Yazar',
            cell: (item: NewsItem) => (
              <span className="text-secondary-foreground truncate text-[13px]/5">
                {item.data?.author || '—'}
              </span>
            ),
          },
        ]
      : []),
    ...(columns.isShown('tags')
      ? [
          {
            id: 'tags',
            width: '12rem',
            from: 'lg' as const,
            header: 'Etiketler',
            cell: (item: NewsItem) =>
              item.data?.tags?.length ? (
                <span className="flex min-w-0 flex-wrap gap-1">
                  {item.data.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} tone="neutral" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </span>
              ) : (
                <span className="text-subtle-foreground text-[13px]/5">—</span>
              ),
          },
        ]
      : []),
    {
      id: 'featured',
      width: { base: 'auto', sm: '7rem' },
      label: 'Öne çıkan',
      cell: (item) => (item.data?.featured ? <StatusChip kind="featured" /> : null),
    },
  ];

  const empty = failed ? (
    <EmptyState kind="failed" title={failed} onRetry={() => void load()} />
  ) : filtered ? (
    <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
  ) : (
    <EmptyState
      kind="first-use"
      title="Henüz duyuru yok"
      action={
        <ActionButton href="/announcements/new" icon={Plus} variant="primary" label="Duyuru ekle" />
      }
    />
  );

  return (
    <ListPage
      title="Duyurular"
      commands={
        <CommandBar label="Duyuru komutları">
          <Command primary icon={Plus} label="Duyuru ekle" href="/announcements/new" />
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      summary={
        items.length ? (
          <SummaryStrip
            items={[
              {
                key: 'all',
                label: 'Duyuru',
                value: items.length,
                active: view === 'all',
                onSelect: () => setParams({ view: 'all' }),
              },
              {
                key: 'featured',
                label: 'Öne çıkan',
                value: items.filter((item) => item.data?.featured).length,
                active: view === 'featured',
                onSelect: () => setParams({ view: 'featured' }),
              },
            ]}
          />
        ) : null
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Başlık, özet, yazar"
          searchLabel="Duyuru ara"
          views={[
            { value: 'all', label: 'Hepsi', count: searched.length },
            { value: 'featured', label: 'Öne çıkan', count: featuredCount },
          ]}
          view={view}
          onView={(next) => setParams({ view: next })}
          columns={
            <ColumnPicker columns={COLUMNS} isShown={columns.isShown} onToggle={columns.toggle} />
          }
        />
      }
      footer={
        <ListFooter
          total={rows.length}
          page={paged.page}
          totalPages={paged.totalPages}
          pageSize={PAGE_SIZE}
          onPage={(page) => setParams({ page })}
        />
      }
    >
      {!loading && (failed || rows.length === 0) ? (
        empty
      ) : (
        <DataList
          columns={listColumns}
          rows={paged.slice}
          getRowId={(item) => item.slug}
          rowHref={(item) => `/announcements/${encodeURIComponent(item.slug)}/edit`}
          rowLabel={(item) => item.data?.title || item.slug}
          loading={loading}
          skeletonRows={6}
        />
      )}
    </ListPage>
  );
}
