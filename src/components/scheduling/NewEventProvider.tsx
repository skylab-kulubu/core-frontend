'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useEventCreate } from '@/lib/use-event-create';

/** The one page where an Event is created, whichever button leads there. */
export const NEW_EVENT_HREF = '/events/new';

const NewEventContext = createContext<{ open: () => void; canCreate: boolean }>({
  open: () => undefined,
  canCreate: false,
});

/** Opens the new event page from any "Etkinlik ekle" button. */
export function useNewEvent() {
  return useContext(NewEventContext);
}

/**
 * Every way to create an Event (the list, the dashboard, the menu) opens the
 * same page with the whole form in sections; there is no second, shorter form.
 */
export function NewEventProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const groups = useMemo(() => user?.groups ?? [], [user?.groups]);
  // core's event.create (the group rule only when unreadable): a DK member creates nothing,
  // a Leader of a Team above creates for its Sub-teams too
  const { canCreate } = useEventCreate(groups);
  const open = useCallback(() => router.push(NEW_EVENT_HREF), [router]);
  const value = useMemo(() => ({ open, canCreate }), [open, canCreate]);
  return <NewEventContext.Provider value={value}>{children}</NewEventContext.Provider>;
}
