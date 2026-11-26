'use client';

import { Skeleton } from '@skylab-kulubu/skylcn-ui';
import { useState } from 'react';
import { LoadError } from '@/components/chrome/LoadError';
import {
  EventTemplateRow,
  TemplateBindingDialog,
  useEventTemplateState,
} from '@/components/certificates/EventTemplateRow';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';

/**
 * The edit page's Şablon row (Sertifika section): the saved Event's template,
 * its editor and the team templates to choose from. `leave` asks first while
 * a change is unsaved.
 */
export function EventEditTemplate({ leave }: { leave: (href: string) => void }) {
  const { event, canMutate, canBindCertificate } = useEventWorkspace();
  const template = useEventTemplateState(event.id, canMutate);
  const [picking, setPicking] = useState(false);

  if (template.status === 'failed') {
    return <LoadError title={template.error} onRetry={() => void template.reload()} />;
  }
  if (template.status !== 'ready') return <Skeleton className="h-14 w-full" />;
  return (
    <>
      <EventTemplateRow
        eventId={event.id}
        view={template.view}
        canEdit={canMutate}
        canPick={canMutate || canBindCertificate}
        leave={leave}
        onPick={() => setPicking(true)}
      />
      {template.view.legacy ? null : (
        <TemplateBindingDialog
          open={picking}
          onClose={() => setPicking(false)}
          eventId={event.id}
          choices={template.view.choices}
          eventTemplate={template.view.eventTemplate}
          resolution={template.view.resolution}
          onDone={() => void template.reload()}
        />
      )}
    </>
  );
}
