'use client';

import { buttonVariants, cn } from '@skylab-kulubu/skylcn-ui';
import { DoorOpen, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Forbidden } from '@/components/chrome/PageState';
import { StateCard } from '@/components/chrome/StateCard';
import { DoorStaffField, EntryModeField } from '@/components/scheduling/EventEditor';
import { useEditsDoorStaff, useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import {
  EventCardFrame,
  EventSettingsCard,
} from '@/components/scheduling/settings/EventSettingsCard';
import { SessionQrDrawer, sessionForQr } from '@/components/scheduling/SessionQrDrawer';
import type { EventSession } from '@/lib/api/sessions';
import { EVENT_CARDS, eventDoorHref } from '@/lib/event-workspace';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

/**
 * Kapı: the way into the scanning page (which stays at /door, full screen, for the door staff's
 * saved links), the session QR, and for who edits the event the door's layout and its staff.
 */
export default function EventCheckinPage() {
  const { event, sessions, canDesk, canMutate, editor } = useEventWorkspace();
  const editsDoorStaff = useEditsDoorStaff();
  const [qrSession, setQrSession] = useState<EventSession | null>(null);
  const qrTarget = sessionForQr(sessions);

  if (!canDesk && !canMutate) return <Forbidden />;

  return (
    <div className="flex max-w-3xl min-w-0 flex-col gap-4">
      {canDesk || qrTarget ? (
        <EventCardFrame id="tarama" title="Tarama">
          <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
            Bilet okutma ve misafir QR’ı tarama sayfasında.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {canDesk ? (
              <Link
                href={eventDoorHref(event.id)}
                className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), BUTTON_TEXT)}
              >
                <DoorOpen aria-hidden />
                Taramayı aç
              </Link>
            ) : null}
            {qrTarget ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), BUTTON_TEXT)}
                onClick={() => setQrSession(qrTarget)}
              >
                <QrCode aria-hidden />
                Oturum QR
              </button>
            ) : null}
          </div>
        </EventCardFrame>
      ) : null}
      {canMutate && !editor.ready ? <StateCard title="Yükleniyor…" isLoading /> : null}
      {canMutate && editor.ready ? (
        <EventSettingsCard id={EVENT_CARDS.entryMode} title="Kapı düzeni" fields={['entryMode']}>
          {(fields) => <EntryModeField {...fields} />}
        </EventSettingsCard>
      ) : null}
      {editsDoorStaff && editor.ready ? (
        <EventSettingsCard
          id={EVENT_CARDS.doorStaff}
          title="Kapı görevlileri"
          fields={['doorStaffIds']}
        >
          {(fields) => <DoorStaffField {...fields} label={false} />}
        </EventSettingsCard>
      ) : null}
      <SessionQrDrawer
        session={qrSession}
        sessions={sessions}
        canDesk={canDesk}
        onClose={() => setQrSession(null)}
      />
    </div>
  );
}
