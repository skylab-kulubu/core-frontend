'use client';

import { useState } from 'react';
import { CopyButton } from '@skylab-kulubu/skylcn-ui';
import { MousePointerClick, Pencil, QrCode, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Pagination } from '@/components/chrome/Pagination';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { publicShortUrl, type ShortUrl } from '@/lib/api/urls';
import { isManaged, linkKind, linkKindLabel, managedNote } from '@/lib/short-links';
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
  canChange = () => true,
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
  /** Whether core would take an edit or delete of this row; false hides Düzenle and Sil. */
  canChange?: (row: ShortUrl) => boolean;
  /** A Form or Event link is deleted only by a URL moderator (url.moderateWrite). */
  canDeleteManaged?: boolean;
  /** A kind is chosen, so an empty list is a non-match. */
  filtered?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const visible = items.filter((row) =>
    matchesQuery(query, row.alias, row.url, row.label, publicShortUrl(row.alias)),
  );
  const paged = paginateRows(visible, page);
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
          // A Form or an Event decides the alias and target; here the link is read-only
          const managed = isManaged(row);
          const note = managedNote(row);
          const details = [row.label?.trim(), row.url, showClicks && `${row.clickCount} tıklama`];
          return (
            <ListItem
              key={row.id}
              title={short}
              subtitle={details.filter(Boolean).join(' · ')}
              trailing={
                <>
                  <StatusChip kind="neutral" label={linkKindLabel(kind)} />
                  {note ? (
                    <span className="text-3xs text-subtle-foreground whitespace-nowrap">
                      {note}
                    </span>
                  ) : null}
                  {/* The tick shows in place; a copy is not a write, so no toast */}
                  <CopyButton value={short} label="Kopyala" variant="outline" size="icon" />
                  <ActionButton icon={QrCode} label="QR" onClick={() => onQr(row)} />
                  {onHits ? (
                    <ActionButton
                      icon={MousePointerClick}
                      label="Tıklamalar"
                      onClick={() => onHits(row)}
                    />
                  ) : null}
                  {canChange(row) ? (
                    <>
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
                        title={managed && !canDeleteManaged ? (note ?? undefined) : undefined}
                        disabled={managed && !canDeleteManaged}
                        onClick={() => onDelete(row)}
                      />
                    </>
                  ) : null}
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
