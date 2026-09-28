'use client';

import { useState } from 'react';
import { Copy, MousePointerClick, Pencil, QrCode, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Pagination } from '@/components/chrome/Pagination';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { publicShortUrl, type ShortUrl } from '@/lib/api/urls';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import {
  deleteConfirmText,
  isManaged,
  linkKind,
  linkKindLabel,
  managedNote,
} from '@/lib/short-links';
import { linkKindStatus } from '@/lib/status-chip';

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
  canDeleteManaged = false,
  filtered = false,
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
  /** A URL moderator may delete a managed link; others only see it. */
  canDeleteManaged?: boolean;
  /** A kind filter narrows the list, so an empty list is a non-match. */
  filtered?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const visible = items.filter((row) =>
    matchesQuery(query, row.alias, row.url, row.label, publicShortUrl(row.alias)),
  );
  const paged = paginateRows(visible, page);
  const remove = (row: ShortUrl) => {
    const confirmText = deleteConfirmText(row);
    if (confirmText && !window.confirm(confirmText)) return;
    onDelete(row);
  };
  return (
    <section className="space-y-2">
      <SectionHeading title={title} meta={`${visible.length} bağlantı`} />
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
          rowCount: visible.length,
          emptyMessage: emptyListCopy({
            none: 'Henüz kısa URL yok.',
            noneMatch: 'Eşleşen kısa URL yok.',
            query,
            filtered,
          }),
        })}
        emptyDescription="Hedef adresi kısalt."
      >
        {paged.slice.map((row) => {
          const short = publicShortUrl(row.alias);
          const kind = linkKind(row);
          const managed = isManaged(row);
          const note = managedNote(row);
          const locked = managed && !canDeleteManaged;
          const details = [row.label?.trim(), row.url, showClicks && `${row.clickCount} tıklama`];
          return (
            <ListItem
              key={row.id}
              title={short}
              subtitle={details.filter(Boolean).join(' · ')}
              trailing={
                <>
                  <StatusChip kind={linkKindStatus(kind)} label={linkKindLabel(kind)} />
                  {note ? (
                    <span className="text-3xs text-subtle-foreground whitespace-nowrap">
                      {note}
                    </span>
                  ) : null}
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
                  <ActionButton
                    icon={Pencil}
                    label="Düzenle"
                    title={note ?? undefined}
                    disabled={managed}
                    onClick={() => onEdit(row)}
                  />
                  <ActionButton
                    icon={Trash2}
                    label="Sil"
                    title={locked ? (note ?? undefined) : undefined}
                    disabled={locked}
                    onClick={() => remove(row)}
                  />
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
