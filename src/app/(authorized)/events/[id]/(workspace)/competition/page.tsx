'use client';

import { useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { StatusChip } from '@/components/chrome/StatusChip';
import { personLabel } from '@/components/identity/PersonPick';
import { CompetitionBoard } from '@/components/scheduling/CompetitionBoard';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { useCapabilities } from '@/lib/capabilities-context';
import { eventTabHref } from '@/lib/event-workspace';
import { listStatus } from '@/lib/list-status';
import { teamDecision } from '@/lib/use-app-can';

/**
 * Yarışma tab: the event's competitions in core's competition module (ADR-0068). The records of
 * the old competitor list stay readable below while an event still has them.
 */
export default function EventCompetitionPage() {
  const { event, competitors, personById, canCompetitors } = useEventWorkspace();
  const capabilities = useCapabilities();
  // core's competition.manage for the Owner team; the competitor right when it cannot be read
  const canManage = teamDecision(
    capabilities,
    event.ownerTeam,
    'competition.manage',
    canCompetitors,
  );
  const [legacy, setLegacy] = useState(false);

  return (
    <div className="space-y-6">
      <CompetitionBoard eventId={event.id} canManage={canManage} />
      {competitors.length ? (
        <section aria-label="Eski yarışmacı kayıtları" className="space-y-2">
          <SectionHeading
            title="Eski yarışmacı kayıtları"
            meta={`${competitors.length} kişi`}
            actions={
              <button
                type="button"
                className="text-skylab-300 text-[13px]/5 hover:underline"
                aria-expanded={legacy}
                onClick={() => setLegacy((open) => !open)}
              >
                {legacy ? 'Gizle' : 'Göster'}
              </button>
            }
          />
          {legacy ? (
            <ListPanel
              status={listStatus({
                loading: false,
                rowCount: competitors.length,
                emptyMessage: '',
              })}
            >
              {competitors.map((row) => {
                const person = personById.get(row.userId);
                return (
                  <ListItem
                    key={row.id}
                    href={`${eventTabHref(event.id, 'competition')}/${encodeURIComponent(row.id)}`}
                    title={person ? personLabel(person) : row.userId}
                    subtitle={row.score !== undefined ? `${row.score} puan` : 'Puansız'}
                    trailing={row.isWinner ? <StatusChip kind="winner" /> : undefined}
                  />
                );
              })}
            </ListPanel>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
