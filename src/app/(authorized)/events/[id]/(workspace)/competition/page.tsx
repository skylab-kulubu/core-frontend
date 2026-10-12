'use client';

import { Trophy } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { StatusChip } from '@/components/chrome/StatusChip';
import { personLabel } from '@/components/identity/PersonPick';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { eventTabHref } from '@/lib/event-workspace';
import { listStatus } from '@/lib/list-status';

/** Yarışma tab: the event's competitors, their scores and winners. */
export default function EventCompetitionPage() {
  const { event, competitors, personById, error, canCompetitors } = useEventWorkspace();

  return (
    <div className="space-y-3">
      <SectionHeading
        title="Yarışmacılar"
        meta={`${competitors.length} kişi`}
        actions={
          canCompetitors ? (
            <ActionButton
              icon={Trophy}
              variant="primary"
              label="Yarışmacı ekle"
              href={`${eventTabHref(event.id, 'competition')}/new`}
            />
          ) : null
        }
      />
      <ListPanel
        status={listStatus({
          loading: false,
          failed: Boolean(error),
          rowCount: competitors.length,
          emptyMessage: 'Yarışmacı yok',
        })}
        emptyDescription="Puan ve kazananı burada işaretle."
      >
        {competitors.map((row) => {
          const person = personById.get(row.userId);
          return (
            <ListItem
              key={row.id}
              href={`${eventTabHref(event.id, 'competition')}/${encodeURIComponent(row.id)}`}
              title={person ? personLabel(person) : row.userId}
              subtitle={row.score !== undefined ? String(row.score) : '—'}
              trailing={row.isWinner ? <StatusChip kind="winner" /> : undefined}
            />
          );
        })}
      </ListPanel>
    </div>
  );
}
