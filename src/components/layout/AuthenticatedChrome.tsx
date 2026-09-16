'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
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
      <div className="flex min-h-dvh min-h-screen bg-[#08070b]">
        <Sidebar
          navLinks={sidebarNav}
          prefetchedUser={sidebarUser}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-y-auto text-neutral-200">
            <div className="mx-auto w-full max-w-6xl p-6">{children}</div>
          </main>
        </div>
      </div>
    </MobileSidebarContext.Provider>
  );
}
