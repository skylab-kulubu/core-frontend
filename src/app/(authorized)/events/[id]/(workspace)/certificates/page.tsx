'use client';

import { Forbidden } from '@/components/chrome/PageState';
import { EventCertificatesPanel } from '@/components/certificates/EventCertificatesPanel';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { eventEditHref } from '@/lib/event-workspace';
import { lastSessionEnded } from '@/lib/certificate-attendance';
import { attendanceFinalizeOpen } from '@/lib/events-view';

/** Sertifikalar tab: the template, attendance and issued certificates of the event. */
export default function EventCertificatesPage() {
  const {
    event,
    tickets,
    canCertificates,
    canIssueCertificate,
    canBindCertificate,
    canRevokeCertificate,
    canReadIssuedCertificates,
    canMutate,
    days,
    sessions,
    reload,
  } = useEventWorkspace();

  if (!canCertificates) {
    return <Forbidden />;
  }

  return (
    <EventCertificatesPanel
      eventId={event.id}
      ownerTeam={event.ownerTeam}
      attendanceRule={event.attendanceRule ?? 'none'}
      attendanceRatio={event.attendanceRatio}
      finalizeOpen={attendanceFinalizeOpen(event)}
      lastSessionEnded={lastSessionEnded(event, days, sessions)}
      tickets={tickets}
      canIssue={canIssueCertificate}
      canBind={canBindCertificate}
      canRevoke={canRevokeCertificate}
      canReadIssued={canReadIssuedCertificates}
      canEditEvent={canMutate}
      ruleHref={canMutate ? `${eventEditHref(event.id)}#sertifika` : undefined}
      days={days}
      onRuleSaved={() => void reload()}
    />
  );
}
