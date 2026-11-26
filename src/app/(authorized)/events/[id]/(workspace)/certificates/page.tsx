'use client';

import { Forbidden } from '@/components/chrome/PageState';
import { EventCertificatesPanel } from '@/components/certificates/EventCertificatesPanel';
import { CertificateListDownload } from '@/components/scheduling/exports/ExportMenu';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { lastSessionEnded } from '@/lib/certificate-attendance';
import { attendanceFinalizeOpen } from '@/lib/events-view';

/**
 * Sertifikalar tab: the rule and template (their one place), attendance and issued certificates
 * of the event.
 */
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
      canEditRule={canMutate}
      days={days}
      onRuleSaved={() => void reload()}
      exportAction={
        canReadIssuedCertificates ? (
          <CertificateListDownload eventId={event.id} eventName={event.name} />
        ) : undefined
      }
    />
  );
}
