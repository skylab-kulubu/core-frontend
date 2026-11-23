'use client';

import {
  AppShell,
  AppShellActions,
  Breadcrumbs,
  ControlSizeProvider,
} from '@skylab-kulubu/skylcn-ui';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { NewEventProvider } from '@/components/scheduling/NewEventProvider';
import { useAuth } from '@/context/AuthContext';
import { CapabilitiesProvider } from '@/lib/capabilities-context';
import { chromeCrumbs, chromeDocumentTitle } from '@/lib/chrome-breadcrumbs';
import { isFocusPath } from '@/lib/event-workspace';
import type { UserDto } from '@/types/api';
import { AdminSearch } from './AdminSearch';
import { AdminSidebar } from './AdminSidebar';
import { ChromeCrumbNamesProvider, useChromeCrumbNames } from './chrome-crumb-names';
import { EnvironmentStrip } from './EnvironmentStrip';
import { useNavigationContext } from './use-navigation-context';

type AuthenticatedChromeProps = Readonly<{
  children: React.ReactNode;
  sidebarUser: UserDto;
}>;

function ChromeTrail({ pathname }: { pathname: string }) {
  return <Breadcrumbs items={chromeCrumbs(pathname, useChromeCrumbNames())} />;
}

/** Names the browser tab after the page, its record's name once the page has read it. */
function DocumentTitle({ pathname }: { pathname: string }) {
  const title = chromeDocumentTitle(pathname, useChromeCrumbNames());
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    // Next writes the layout's metadata title after the page mounts (streamed metadata); the
    // page's own name wins whenever it does
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}

export function AuthenticatedChrome({ children, sidebarUser }: AuthenticatedChromeProps) {
  const { user } = useAuth();
  const current = user ?? sidebarUser;
  return (
    <CapabilitiesProvider userId={current.id}>
      <SignedInChrome current={current}>{children}</SignedInChrome>
    </CapabilitiesProvider>
  );
}

function SignedInChrome({ children, current }: { children: React.ReactNode; current: UserDto }) {
  const pathname = usePathname() || '/dashboard';
  const navigationContext = useNavigationContext(current);
  // Inputs and selects at skylcn-ui's lg size: 14px text, the panel's body size
  const page = <ControlSizeProvider size="lg">{children}</ControlSizeProvider>;

  return (
    <NewEventProvider>
      <ChromeCrumbNamesProvider>
        <DocumentTitle pathname={pathname} />
        <EnvironmentStrip />
        {isFocusPath(pathname) ? (
          // A task done start to finish (the door): no sidebar, the page leads back itself
          page
        ) : (
          <AppShell
            // Keeps the collapsed choice people made before the move to skylcn-ui
            storageKey="skylab.admin.sidebar-collapsed"
            sidebar={<AdminSidebar user={current} navigationContext={navigationContext} />}
            header={<ChromeTrail pathname={pathname} />}
          >
            <AppShellActions>
              <AdminSearch user={current} navigationContext={navigationContext} />
            </AppShellActions>
            {page}
          </AppShell>
        )}
      </ChromeCrumbNamesProvider>
    </NewEventProvider>
  );
}
