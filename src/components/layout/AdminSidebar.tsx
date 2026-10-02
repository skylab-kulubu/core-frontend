'use client';

import {
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  SidebarBrand,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarItem,
  SidebarUser,
  useTheme,
  type ThemePreference,
} from '@skylab-kulubu/skylcn-ui';
import { FlaskConical, LogOut, Palette } from 'lucide-react';
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

function consoles() {
  return [
    ...clubConsoleLinks().map((app) => ({ ...app, icon: CONSOLE_ICON[app.id] })),
    // The skylcn-ui playground, only when the image is built with it
    // (NEXT_PUBLIC_INCLUDE_PLAYGROUND=true, see the Dockerfile)
    ...(process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND === 'true'
      ? [{ id: 'playground', label: 'Playground', href: '/playground', icon: FlaskConical }]
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
  const name = displayPersonName(user.firstName, user.lastName, user.username);
  const { theme, setTheme } = useTheme();

  return (
    <>
      <SidebarBrand name="SKY LAB" subtitle="Yönetim" consoles={consoles()} current="admin" />
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
              <MenuSub>
                <MenuSubTrigger icon={Palette}>Tema</MenuSubTrigger>
                <MenuSubContent>
                  <MenuRadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as ThemePreference)}
                  >
                    <MenuRadioItem value="dark">Koyu</MenuRadioItem>
                    <MenuRadioItem value="light">Açık</MenuRadioItem>
                    <MenuRadioItem value="system">Sistem</MenuRadioItem>
                  </MenuRadioGroup>
                </MenuSubContent>
              </MenuSub>
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
