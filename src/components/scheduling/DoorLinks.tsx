'use client';

import { Button, buttonVariants, cn } from '@skylab-kulubu/skylcn-ui';
import { QrCode, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { SessionQrDrawer, sessionForQr } from '@/components/scheduling/SessionQrDrawer';
import { useAuth } from '@/context/AuthContext';
import type { EventSession } from '@/lib/api/sessions';
import { canWriteEvent, isPrivileged } from '@/lib/auth/groups';
import { eventDoorStaffHref } from '@/lib/event-workspace';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';
import { useTeamDecide } from '@/lib/use-app-can';

/**
 * The door's two ways out to its settings, beside the way back to the event: Oturum QR (on the
 * session the door shows, else the one running now) and, for who may choose them, the door staff.
 */
export function DoorLinks({
  eventId,
  ownerTeam,
  sessions,
  sessionId,
}: {
  eventId: string;
  ownerTeam: string;
  sessions: readonly EventSession[];
  /** The session the door shows now; the venue entry or none: the QR opens on the running one. */
  sessionId: string;
}) {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const decide = useTeamDecide();
  const [qrSession, setQrSession] = useState<EventSession | null>(null);
  const live = sessions.filter((session) => !session.cancelled);
  const shown = live.find((session) => session.id === sessionId) ?? sessionForQr(live);
  // The edit page's door staff list: who edits the event and may assign its door staff
  const staff =
    decide(ownerTeam, 'event.update', canWriteEvent(groups, ownerTeam, 'update')) &&
    decide(ownerTeam, 'event.assignDoorStaff', isPrivileged(groups));
  const look = cn(buttonVariants({ variant: 'ghost', size: 'sm' }), BUTTON_TEXT);
  if (!shown && !staff) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {shown ? (
        <Button
          className={BUTTON_TEXT}
          variant="ghost"
          size="sm"
          onClick={() => setQrSession(shown)}
        >
          <QrCode aria-hidden />
          Oturum QR
        </Button>
      ) : null}
      {staff ? (
        <Link href={eventDoorStaffHref(eventId)} className={look} aria-label="Kapı görevlileri">
          <UserCog aria-hidden />
          <span className="hidden sm:inline">Kapı görevlileri</span>
        </Link>
      ) : null}
      <SessionQrDrawer
        session={qrSession}
        sessions={sessions}
        canDesk
        onClose={() => setQrSession(null)}
      />
    </div>
  );
}
