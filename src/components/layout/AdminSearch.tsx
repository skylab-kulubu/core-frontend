'use client';

import {
  Button,
  CommandPalette,
  Kbd,
  useCommandShortcut,
  type CommandItem,
} from '@skylab-kulubu/skylcn-ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { navIcon } from '@/lib/navigation/nav-icons';
import {
  buildSidebarNavigation,
  type SidebarNavigationContext,
} from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

/** "Hızlı git": every page the navigation offers this person, opened with Ctrl/⌘+K. */
export function AdminSearch({
  user,
  navigationContext,
}: {
  user: UserDto;
  navigationContext: SidebarNavigationContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useCommandShortcut(useCallback(() => setOpen(true), []));

  const items = useMemo<CommandItem[]>(
    () =>
      buildSidebarNavigation(user, navigationContext).flatMap((node) =>
        node.kind === 'link'
          ? [
              {
                id: node.href,
                label: node.label,
                group: 'Genel',
                icon: navIcon(node.href),
                href: node.href,
              },
            ]
          : node.children.map((item) => ({
              id: item.href,
              label: item.label,
              group: node.label,
              icon: navIcon(item.href),
              href: item.href,
            })),
      ),
    [navigationContext, user],
  );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Hızlı git"
        className="gap-2"
      >
        <Search />
        <span className="text-subtle-foreground hidden lg:inline">Hızlı git</span>
        <span className="hidden items-center gap-0.5 lg:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </Button>
      <CommandPalette
        items={items}
        open={open}
        onOpenChange={setOpen}
        navigate={(href) => router.push(href)}
        placeholder="Sayfa ara"
      />
    </>
  );
}
