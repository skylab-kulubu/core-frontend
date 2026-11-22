'use client';

import {
  MenuItem,
  MenuLabel,
  MenuLinkItem,
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
import { FlaskConical, Globe, LogOut, Palette, PenLine, UserRound } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { profilePictureSrc } from '@/lib/profile-picture';
import { performClientLogout } from '@/lib/auth/client-logout';
import { clubRoleLabel, displayPersonName } from '@/lib/chrome-role';
import { accountCenterUrl, clubConsoleLinks } from '@/lib/club-switcher';
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
  const name = displayPersonName(user.firstName, user.lastName, user.username);
  const { theme, setTheme } = useTheme();
  // The settings close the list, after the sites the person edits
  const daily = nodes.filter((node) => node.kind === 'link' || node.id !== 'settings');
  const settings = nodes.filter((node) => node.kind === 'group' && node.id === 'settings');

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

  return (
    <>
      <SidebarBrand name="SKY LAB" subtitle="Yönetim" consoles={consoles()} current="admin" />
      <SidebarContent>
        <div className="flex flex-col gap-1">
          {daily.map(renderNode)}
          {navigationContext.editSites?.length ? (
            <SidebarGroup
              label="Siteyi düzenle"
              icon={PenLine}
              storageKey="skylab.admin.nav-group.edit-sites"
            >
              {navigationContext.editSites.map((site) => (
                <SidebarItem
                  key={site.href}
                  href={site.href}
                  label={site.label}
                  icon={Globe}
                  external
                />
              ))}
            </SidebarGroup>
          ) : null}
          {settings.map(renderNode)}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          name={name}
          avatarSrc={profilePictureSrc(user)}
          email={user.email}
          subtitle={clubRoleLabel(user.groups ?? [])}
          menu={
            <>
              {user.email ? <MenuLabel>{user.email}</MenuLabel> : null}
              <MenuLinkItem href={accountCenterUrl()} icon={UserRound}>
                Hesap merkezi
              </MenuLinkItem>
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
