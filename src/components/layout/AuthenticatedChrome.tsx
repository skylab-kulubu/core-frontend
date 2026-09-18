'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { MobileSidebarContext } from './MobileSidebarContext';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

type AuthenticatedChromeProps = Readonly<{
  children: React.ReactNode;
  sidebarNav: readonly SidebarNavLink[];
  sidebarUser: UserDto;
}>;

export function AuthenticatedChrome({
  children,
  sidebarNav,
  sidebarUser,
}: AuthenticatedChromeProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <MobileSidebarContext.Provider
      value={{
        open: () => setIsMobileSidebarOpen(true),
        close: () => setIsMobileSidebarOpen(false),
        isOpen: isMobileSidebarOpen,
      }}
    >
      <div className="min-h-dvh md:h-dvh md:bg-neutral-950 md:py-2 md:pr-2 md:pl-66">
        <Sidebar
          navLinks={sidebarNav}
          prefetchedUser={sidebarUser}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />

        <div className="sticky top-0 z-40 border-b border-neutral-950/70 bg-neutral-950/40 backdrop-blur md:hidden">
          <div className="flex h-14 items-center px-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="focus-visible:ring-skylab-400/40 inline-flex items-center justify-center rounded-md p-2 text-neutral-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-2 min-w-0 flex-1">
              <Breadcrumbs />
            </div>
          </div>
        </div>

        <div className="md:flex md:h-full md:min-h-0 md:flex-col md:overflow-hidden md:rounded-xl md:border md:border-white/5 md:bg-neutral-900">
          <div className="hidden h-10 shrink-0 items-center border-b border-white/5 px-6 md:flex">
            <Breadcrumbs />
          </div>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl p-6">{children}</div>
          </div>
        </div>
      </div>
    </MobileSidebarContext.Provider>
  );
}
