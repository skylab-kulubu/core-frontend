'use client';

import { StateCard } from '@/components/chrome/StateCard';
import { EventFilesPanel } from '@/components/scheduling/EventFilesPanel';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';

/** İçerik tab: the event's presentation files and videos. */
export default function EventContentPage() {
  const { event, setEvent, canMutate } = useEventWorkspace();

  if (!canMutate && !event.videos?.length && !event.files?.length) {
    return <StateCard title="Bu etkinlikte dosya ya da video yok" />;
  }

  return <EventFilesPanel event={event} canEdit={canMutate} onEvent={setEvent} />;
}
