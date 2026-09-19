'use client';

import { useState } from 'react';
import { Copy, MousePointerClick, Pencil, QrCode, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Pagination } from '@/components/chrome/Pagination';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { ListPanel } from '@/components/chrome/ListPanel';
import { publicShortUrl, type ShortUrl } from '@/lib/api/urls';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';

export function UrlList({
  title,
  items,
  loading,
  failed,
  onEdit,
  onQr,
  onHits,
  onDelete,
  showClicks = false,
}: {
  title: string;
  items: ShortUrl[];
  loading: boolean;
  failed: boolean;
  onEdit: (row: ShortUrl) => void;
  onQr: (row: ShortUrl) => void;
  onHits?: (row: ShortUrl) => void;
  onDelete: (row: ShortUrl) => void;
  showClicks?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filtered = items.filter((row) =>
    matchesQuery(query, row.alias, row.url, publicShortUrl(row.alias)),
  );
  const paged = paginateRows(filtered, page);
  return (
    <section className="space-y-2">
      <SectionHeading title={title} meta={`${filtered.length} bağlantı`} />
      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Kısa ad veya hedef"
        searchLabel={`${title} ara`}
      />
      <ListPanel
        status={listStatus({
          loading,
          failed,
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Henüz kısa URL yok.',
            noneMatch: 'Eşleşen kısa URL yok.',
            query,
          }),
        })}
        emptyDescription="Hedef adresi kısalt."
      >
        {paged.slice.map((row) => {
          const short = publicShortUrl(row.alias);
          return (
            <ListItem
              key={row.id}
              title={short}
              subtitle={showClicks ? `${row.url} · ${row.clickCount} tıklama` : row.url}
              trailing={
                <>
                  <ActionButton
                    icon={Copy}
                    label="Kopyala"
                    onClick={() => void navigator.clipboard.writeText(short)}
                  />
                  <ActionButton icon={QrCode} label="QR" onClick={() => onQr(row)} />
                  {onHits ? (
                    <ActionButton
                      icon={MousePointerClick}
                      label="Tıklamalar"
                      onClick={() => onHits(row)}
                    />
                  ) : null}
                  <ActionButton icon={Pencil} label="Düzenle" onClick={() => onEdit(row)} />
                  <ActionButton icon={Trash2} label="Sil" onClick={() => onDelete(row)} />
                </>
              }
            />
          );
        })}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
    </section>
  );
}
