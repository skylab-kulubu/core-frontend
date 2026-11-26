import type { ReactNode } from 'react';
import { ParticipantsTabs } from '@/components/scheduling/settings/ParticipantsTabs';

/** Katılımcılar: its list and its Kayıt ayarları under one pair of tabs. */
export default function EventParticipantsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ParticipantsTabs />
      {children}
    </>
  );
}
