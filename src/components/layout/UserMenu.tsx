'use client';

import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuItem,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  useTheme,
  type ThemePreference,
} from '@skylab-kulubu/skylcn-ui';
import { Globe, LogOut, Palette, PenLine, UserRound } from 'lucide-react';
import { performClientLogout } from '@/lib/auth/client-logout';
import { clubRoleLabel, displayPersonName } from '@/lib/chrome-role';
import { accountCenterUrl } from '@/lib/club-switcher';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-nav';
import { profilePictureSrc } from '@/lib/profile-picture';
import type { UserDto } from '@/types/api';

/**
 * The signed-in person at the top right of every page, as in Entra and Microsoft 365:
 * their name and e-mail, the account center, the theme, the sites they edit and sign-out.
 *
 * skylcn-ui draws the account at the foot of the sidebar (SidebarUser); a top-bar account
 * menu belongs in skylcn-ui's AppShell (Kaan).
 */
export function UserMenu({
  user,
  editSites = [],
}: {
  user: UserDto;
  /** "Siteyi düzenle": the editor sign-in of each site the person may edit. */
  editSites?: readonly SidebarNavLink[];
}) {
  const name = displayPersonName(user.firstName, user.lastName, user.username);
  const role = clubRoleLabel(user.groups ?? []);
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Hesap: ${name}`}
        title={name}
        className="hover:bg-accent data-popup-open:bg-accent focus-visible:ring-ring grid size-8 shrink-0 place-items-center rounded-full outline-hidden focus-visible:ring-2"
      >
        <Avatar name={name} email={user.email} src={profilePictureSrc(user)} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={name} email={user.email} src={profilePictureSrc(user)} size="md" />
          <div className="min-w-0">
            <p className="text-foreground-strong truncate text-sm font-medium">{name}</p>
            {user.email ? (
              <p className="text-subtle-foreground truncate text-[13px]/5">{user.email}</p>
            ) : null}
            {role ? <p className="text-muted-foreground truncate text-xs">{role}</p> : null}
          </div>
        </div>
        <MenuSeparator />
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
        {editSites.length ? (
          <MenuSub>
            <MenuSubTrigger icon={PenLine}>Siteyi düzenle</MenuSubTrigger>
            <MenuSubContent>
              {editSites.map((site) => (
                <MenuLinkItem key={site.href} href={site.href} icon={Globe}>
                  {site.label}
                </MenuLinkItem>
              ))}
            </MenuSubContent>
          </MenuSub>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={LogOut} destructive onClick={() => void performClientLogout()}>
          Çıkış yap
        </MenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
