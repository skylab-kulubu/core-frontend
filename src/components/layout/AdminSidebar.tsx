'use client';

import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  SidebarBrand,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarItem,
  SidebarUser,
} from '@skylab-kulubu/skylcn-ui';
import { LogOut } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { performClientLogout } from '@/lib/auth/client-logout';
import { clubRoleLabel, displayPersonName } from '@/lib/chrome-role';
import { clubConsoleLinks } from '@/lib/club-switcher';
import { isNavActive } from '@/lib/navigation/nav-active';
import { CONSOLE_ICON, groupIcon, navIcon } from '@/lib/navigation/nav-icons';
import {
  buildSidebarNavigation,
  type SidebarNavigationContext,
} from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

const CONSOLES = clubConsoleLinks().map((app) => ({ ...app, icon: CONSOLE_ICON[app.id] }));

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
  const name = displayPersonName(user.firstName, user.lastName, user.username);

  return (
    <>
      <SidebarBrand name="SKY LAB" subtitle="Yönetim" consoles={CONSOLES} current="admin" />
      <SidebarContent>
        <div className="flex flex-col gap-1">
          {nodes.map((node) =>
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
                active={
                  node.id === 'active-event' || node.children.some((item) => active(item.href))
                }
                defaultOpen={node.id === 'events' || node.id === 'active-event' ? true : undefined}
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
            ),
          )}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          name={name}
          email={user.email}
          subtitle={clubRoleLabel(user.groups ?? [])}
          menu={
            <>
              {user.email ? <MenuLabel>{user.email}</MenuLabel> : null}
              <MenuSeparator />
              <MenuItem icon={LogOut} destructive onClick={() => void performClientLogout()}>
                Çıkış yap
              </MenuItem>
            </>
          }
        />
      </SidebarFooter>
    </>
  );
}
