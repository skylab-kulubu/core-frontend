'use client';

import { AppShell, AppShellActions, Breadcrumbs } from '@skylab-kulubu/skylcn-ui';
import { usePathname } from 'next/navigation';
import { NewEventProvider } from '@/components/scheduling/NewEventProvider';
import { useAuth } from '@/context/AuthContext';
import { chromeCrumbs } from '@/lib/chrome-breadcrumbs';
import type { UserDto } from '@/types/api';
import { AdminSearch } from './AdminSearch';
import { AdminSidebar } from './AdminSidebar';
import { ChromeCrumbNamesProvider, useChromeCrumbNames } from './chrome-crumb-names';
import { useNavigationContext } from './use-navigation-context';

type AuthenticatedChromeProps = Readonly<{
  children: React.ReactNode;
  sidebarUser: UserDto;
}>;

function ChromeTrail({ pathname }: { pathname: string }) {
  return <Breadcrumbs items={chromeCrumbs(pathname, useChromeCrumbNames())} />;
}

export function AuthenticatedChrome({ children, sidebarUser }: AuthenticatedChromeProps) {
  const pathname = usePathname() || '/dashboard';
  const { user } = useAuth();
  const current = user ?? sidebarUser;
  const navigationContext = useNavigationContext(current);

  return (
    <NewEventProvider>
      <ChromeCrumbNamesProvider>
        <AppShell
          // Keeps the collapsed choice people made before the move to skylcn-ui
          storageKey="skylab.admin.sidebar-collapsed"
          sidebar={<AdminSidebar user={current} navigationContext={navigationContext} />}
          header={<ChromeTrail pathname={pathname} />}
        >
          <AppShellActions>
            <AdminSearch user={current} navigationContext={navigationContext} />
          </AppShellActions>
          {children}
        </AppShell>
      </ChromeCrumbNamesProvider>
    </NewEventProvider>
  );
}
