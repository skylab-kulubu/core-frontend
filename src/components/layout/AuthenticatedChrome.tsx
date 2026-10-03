'use client';

import { AppShell, AppShellActions, Breadcrumbs } from '@skylab-kulubu/skylcn-ui';
import { usePathname } from 'next/navigation';
import { NewEventProvider } from '@/components/scheduling/NewEventProvider';
import { useAuth } from '@/context/AuthContext';
import { chromeCrumbs } from '@/lib/chrome-breadcrumbs';
import type { UserDto } from '@/types/api';
import { AdminSearch } from './AdminSearch';
import { AdminSidebar } from './AdminSidebar';
import { useNavigationContext } from './use-navigation-context';

type AuthenticatedChromeProps = Readonly<{
  children: React.ReactNode;
  sidebarUser: UserDto;
}>;

export function AuthenticatedChrome({ children, sidebarUser }: AuthenticatedChromeProps) {
  const pathname = usePathname() || '/dashboard';
  const { user } = useAuth();
  const current = user ?? sidebarUser;
  const navigationContext = useNavigationContext(current);

  return (
    <NewEventProvider>
      <AppShell
        // Keeps the collapsed choice people made before the move to skylcn-ui
        storageKey="skylab.admin.sidebar-collapsed"
        sidebar={<AdminSidebar user={current} navigationContext={navigationContext} />}
        header={<Breadcrumbs items={chromeCrumbs(pathname)} />}
      >
        <AppShellActions>
          <AdminSearch user={current} navigationContext={navigationContext} />
        </AppShellActions>
        {children}
      </AppShell>
    </NewEventProvider>
  );
}
