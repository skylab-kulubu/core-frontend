'use client';

import { SidebarBrand, SidebarContent, SidebarGroup, SidebarItem } from '@skylab-kulubu/skylcn-ui';
import { FlaskConical } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { clubConsoleLinks } from '@/lib/club-switcher';
import { isNavActive } from '@/lib/navigation/nav-active';
import { CONSOLE_DESCRIPTION, CONSOLE_ICON, groupIcon, navIcon } from '@/lib/navigation/nav-icons';
import {
  buildSidebarNavigation,
  type SidebarNavigationContext,
  type SidebarNavNode,
} from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

function consoles() {
  return [
    ...clubConsoleLinks().map((app) => ({
      ...app,
      icon: CONSOLE_ICON[app.id],
      description: CONSOLE_DESCRIPTION[app.id],
    })),
    // The skylcn-ui playground, only when the image is built with it
    // (NEXT_PUBLIC_INCLUDE_PLAYGROUND=true, see the Dockerfile)
    ...(process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND === 'true'
      ? [
          {
            id: 'playground',
            label: 'Playground',
            href: '/playground',
            icon: FlaskConical,
            description: CONSOLE_DESCRIPTION.playground,
          },
        ]
      : []),
  ];
}

export function AdminSidebar({
  user,
  navigationContext,
}: {
  user: UserDto;
  navigationContext: SidebarNavigationContext;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const nodes = buildSidebarNavigation(user, navigationContext);
  const active = (href: string) => isNavActive(pathname, search, href);

  const renderNode = (node: SidebarNavNode) =>
    node.kind === 'link' ? (
      <SidebarItem
        key={node.href}
        href={node.href}
        label={node.label}
        icon={navIcon(node.href)}
        active={active(node.href)}
      />
    ) : (
      <SidebarGroup
        key={node.id}
        label={node.label}
        icon={groupIcon(node.id)}
        active={node.children.some((item) => active(item.href))}
        // The day's groups start open; Ayarlar opens on one of its pages or when left open
        defaultOpen={node.id === 'settings' ? undefined : true}
        storageKey={`skylab.admin.nav-group.${node.id}`}
      >
        {node.children.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={navIcon(item.href)}
            active={active(item.href)}
          />
        ))}
      </SidebarGroup>
    );

  // The account, the theme and the sites the person edits are in the top bar's account menu
  return (
    <>
      <SidebarBrand name="SKY LAB" subtitle="Yönetim" consoles={consoles()} current="admin" />
      <SidebarContent>
        <div className="flex flex-col gap-1">{nodes.map(renderNode)}</div>
      </SidebarContent>
    </>
  );
}
