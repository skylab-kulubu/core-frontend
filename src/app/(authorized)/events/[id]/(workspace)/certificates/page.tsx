'use client';

import { SectionHeading } from '@/components/chrome/PanelChart';
import { StateCard } from '@/components/chrome/StateCard';
import { EventCertificatesPanel } from '@/components/certificates/EventCertificatesPanel';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';

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
  } = useEventWorkspace();

  if (!canCertificates) {
    return <StateCard title="Sertifikaları görme yetkin yok" tone="danger" />;
  }

  return (
    <div className="space-y-3">
      <SectionHeading title="Sertifikalar" meta="Şablon, katılım ve üretim" />
      <EventCertificatesPanel
        eventId={event.id}
        ownerTeam={event.ownerTeam}
        attendanceRule={event.attendanceRule ?? 'none'}
        attendanceRatio={event.attendanceRatio}
        eventActive={event.active}
        tickets={tickets}
        canIssue={canIssueCertificate}
        canBind={canBindCertificate}
        canRevoke={canRevokeCertificate}
        canReadIssued={canReadIssuedCertificates}
      />
    </div>
  );
}
