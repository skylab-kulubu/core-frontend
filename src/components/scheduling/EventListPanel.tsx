'use client';

import { DescriptionList, Sparkline, type DescriptionItem } from '@skylab-kulubu/skylcn-ui';
import { ClipboardList, Settings2, Users } from 'lucide-react';
import { CoverFrame } from '@/components/chrome/object-page/ObjectCover';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { StatusChip } from '@/components/chrome/StatusChip';
import { ReadinessList } from '@/components/scheduling/overview/OverviewParts';
import type { EventStat } from '@/lib/api/dashboard';
import type { CoreEvent } from '@/lib/api/events';
import { legacyEditHref, eventSettingsHref, eventTabHref } from '@/lib/event-workspace';
import { publicMediaUrl } from '@/lib/event-media';
import { eventInitials, eventWhenLong } from '@/lib/event-overview';
import { eventDisplayStatus, eventGaps, type EventGap } from '@/lib/events-view';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** Each gap's row, and the old Düzenle section that now leads to its card. */
const GAP_ROWS: Record<EventGap, { label: string; section: string }> = {
  date: { label: 'Tarih', section: 'zaman' },
  place: { label: 'Yer', section: 'zaman' },
  cover: { label: 'Kapak', section: 'temel' },
  form: { label: 'Başvuru formu', section: 'basvuru' },
};

const percent = (part: number, whole: number) =>
  whole > 0 ? `%${Math.round((part / whole) * 100)}` : '';

/** A filled share as a thin bar; the figure beside it says the value. */
export function ShareBar({ share, className }: { share: number; className?: string }) {
  const width = Math.max(0, Math.min(100, share * 100));
  return (
    <span aria-hidden className="bg-muted block h-1.5 w-full overflow-hidden rounded-full">
      <span
        className={`block h-full rounded-full ${className ?? 'bg-skylab-400'}`}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

/**
 * The Event a list row opens beside the list: its cover whole, its state, the figures with
 * their trend, what it still lacks and the pages a reader goes to next.
 */
export function EventListPanel({
  event,
  stat,
  canEdit,
}: {
  event: CoreEvent;
  /** Its figures; missing when the reader may not read its applicants. */
  stat?: EventStat;
  canEdit: boolean;
}) {
  const status = eventDisplayStatus(event);
  const gaps = eventGaps(event);
  const cover = event.coverImageUrl ? publicMediaUrl(event.coverImageUrl) : undefined;
  const items: DescriptionItem[] = [
    { label: 'Tarih', value: eventWhenLong(event) || 'Tarihsiz' },
    { label: 'Yer', value: event.location?.trim() || '—' },
    { label: 'Ekip', value: event.ownerTeam?.trim() || 'Genel' },
    { label: 'Kontenjan', value: event.capacity > 0 ? event.capacity : 'Sınırsız' },
  ];
  if (stat) {
    items.push(
      {
        label: 'Kayıt',
        value: `${stat.applications} (${stat.members} üye, ${stat.guests} misafir)`,
      },
      {
        label: 'Giriş',
        value: stat.applications
          ? `${stat.checkedIn} · ${percent(stat.checkedIn, stat.applications)}`
          : stat.checkedIn,
      },
    );
  }
  const recent = stat?.dailyApplications.reduce((sum, n) => sum + n, 0) ?? 0;
  return (
    <div className="space-y-4">
      <CoverFrame src={cover} initials={eventInitials(event.name)} className="w-full" />
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip kind={status} />
        {event.registrationOpen ? <StatusChip kind="active" label="Kayıt açık" /> : null}
      </div>
      <CommandBar label="Etkinlik">
        <Command icon={Users} label="Katılımcılar" href={eventTabHref(event.id, 'participants')} />
        <Command icon={ClipboardList} label="Program" href={eventTabHref(event.id, 'program')} />
        {canEdit ? (
          <Command icon={Settings2} label="Ayarlar" href={eventSettingsHref(event.id)} />
        ) : null}
      </CommandBar>
      <DescriptionList items={items} columns={1} />
      {stat ? (
        <ObjectCard title="Kayıtlar">
          <div className="space-y-3">
            {event.capacity > 0 ? (
              <div className="space-y-1.5">
                <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
                  {stat.applications} / {event.capacity} dolu
                </p>
                <ShareBar share={stat.applications / event.capacity} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
                Son 14 gün: {recent} kayıt
              </p>
              <Sparkline values={stat.dailyApplications} className="h-10 w-full" />
            </div>
          </div>
        </ObjectCard>
      ) : null}
      {gaps.length ? (
        <ObjectCard title="Eksikler">
          <ReadinessList
            items={gaps.map((gap) => ({
              key: gap,
              label: GAP_ROWS[gap].label,
              done: false,
              href: legacyEditHref(event.id, GAP_ROWS[gap].section),
            }))}
          />
        </ObjectCard>
      ) : null}
    </div>
  );
}
