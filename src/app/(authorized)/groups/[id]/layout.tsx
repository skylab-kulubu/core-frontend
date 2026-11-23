import type { ReactNode } from 'react';
import { GroupWorkspace } from '@/components/identity/group/GroupWorkspace';

/** One Group's pages: its band, commands and menu stay while the pages below change. */
export default function GroupLayout({ children }: { children: ReactNode }) {
  return <GroupWorkspace>{children}</GroupWorkspace>;
}
