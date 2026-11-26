'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { legacyEditHref } from '@/lib/event-workspace';

/**
 * The old Düzenle page: its settings moved to the pages they belong to. A saved link
 * (/events/[id]/edit, its sections as #basvuru, #kapi-gorevlileri…) lands where its section went;
 * the server never sees the #section, so the page turns it here.
 */
export default function EventEditRedirect() {
  const router = useRouter();
  const { event } = useEventWorkspace();
  useEffect(() => {
    router.replace(legacyEditHref(event.id, window.location.hash));
  }, [router, event.id]);
  return <StateCard title="Yükleniyor…" isLoading />;
}
