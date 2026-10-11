import type { ReactNode } from 'react';
import { EventWorkspace } from '@/components/scheduling/EventWorkspace';

/** One event's workspace: its header and tabs stay while the tab routes below change. */
export default async function EventWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventWorkspace eventId={id}>{children}</EventWorkspace>;
}
