'use client';

import { DataList, DataListTitle, MenuItem, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { Unlink } from 'lucide-react';
import type { ReactNode } from 'react';
import { RowMenu } from '@/components/chrome/ListPage';
import { EmptyState } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { EventStat } from '@/lib/api/dashboard';
import type { CoreEvent } from '@/lib/api/events';
import { eventDisplayStatus, formatEventWhen } from '@/lib/events-view';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const fmt = (n: number) => n.toLocaleString('tr-TR');

/** The season's events: when, whose, how many applied and came; a row opens the event. */
export function SeasonEvents({
  events,
  stats,
  canEdit,
  onUnassign,
  addAction,
}: {
  events: readonly CoreEvent[];
  stats: readonly EventStat[] | null;
  canEdit: boolean;
  onUnassign: (event: CoreEvent) => void;
  /** The way to link the first event, on the empty list. */
  addAction?: ReactNode;
}) {
  const byId = new Map((stats ?? []).map((row) => [row.id, row]));
  const rows = [...events].sort(
    (a, b) => Date.parse(b.startDate ?? '') - Date.parse(a.startDate ?? '') || 0,
  );
  if (!rows.length) {
    return <EmptyState kind="first-use" title="Bu sezonda etkinlik yok" action={addAction} />;
  }
  const columns: DataListColumn<CoreEvent>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Etkinlik',
      cell: (event) => (
        <DataListTitle
          title={event.name}
          subtitle={
            <span className={TEXT_SECONDARY}>
              {[formatEventWhen(event), event.ownerTeam].filter(Boolean).join(' · ') || '—'}
            </span>
          }
        />
      ),
    },
    ...(stats
      ? [
          {
            id: 'applications',
            width: '6rem',
            from: 'md' as const,
            align: 'end' as const,
            header: 'Başvuru',
            cell: (event: CoreEvent) => (
              <span className="text-secondary-foreground text-sm tabular-nums">
                {byId.has(event.id) ? fmt(byId.get(event.id)!.applications) : '—'}
              </span>
            ),
          },
          {
            id: 'attendees',
            width: '6rem',
            from: 'md' as const,
            align: 'end' as const,
            header: 'Katılım',
            cell: (event: CoreEvent) => (
              <span className="text-secondary-foreground text-sm tabular-nums">
                {byId.has(event.id) ? fmt(byId.get(event.id)!.checkedIn) : '—'}
              </span>
            ),
          },
        ]
      : []),
    {
      id: 'status',
      width: { base: 'auto', sm: '7rem' },
      align: 'end',
      label: 'Durum',
      cell: (event) => <StatusChip kind={eventDisplayStatus(event)} />,
    },
    ...(canEdit
      ? [
          {
            id: 'actions',
            width: '2.5rem',
            align: 'end' as const,
            label: 'Eylemler',
            interactive: true,
            cell: (event: CoreEvent) => (
              <RowMenu rowName={event.name}>
                <MenuItem icon={Unlink} onClick={() => onUnassign(event)}>
                  Sezondan çıkar
                </MenuItem>
              </RowMenu>
            ),
          },
        ]
      : []),
  ];
  return (
    <DataList
      columns={columns}
      rows={rows}
      getRowId={(event) => event.id}
      rowHref={(event) => `/events/${encodeURIComponent(event.id)}`}
      rowLabel={(event) => event.name}
    />
  );
}
