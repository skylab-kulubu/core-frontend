'use client';

import {
  Avatar,
  avatarTone,
  cn,
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
import { ChevronDown, Globe, LogOut, Palette, PenLine, UserRound } from 'lucide-react';
import { performClientLogout } from '@/lib/auth/client-logout';
import { clubRoleLabel, displayPersonName } from '@/lib/chrome-role';
import { accountCenterUrl } from '@/lib/club-switcher';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-nav';
import { profilePictureSrc } from '@/lib/profile-picture';
import type { UserDto } from '@/types/api';

/*
 * The account button, the same in every SKY LAB product's top bar (Microsoft 365 / Google
 * style, 2026-11-23): a 32 px avatar (photo or initials on a coloured ground); on desktop the
 * name first (cut at about 16 characters), then a chevron, the avatar last against the corner
 * (as in Entra and the Azure portal), in a thin-bordered pill 36 px high;
 * on phones the avatar alone in a 36 px touch target. Hover, open and focus are drawn.
 * skymail-frontend's UserMenu carries the same classes; skylcn-ui's AccountMenu should too (Kaan).
 */
const ACCOUNT_BUTTON =
  'group text-foreground hover:bg-accent data-popup-open:bg-accent focus-visible:ring-ring focus-visible:ring-offset-background flex size-9 shrink-0 items-center justify-center rounded-full border border-transparent outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 md:w-auto md:justify-start md:gap-2 md:border-border md:bg-muted/40 md:pr-px md:pl-2.5 md:hover:border-border-strong md:data-popup-open:border-border-strong';

/** Stronger than the lists' faint tint, so the button reads at a glance; same hue per person. */
const AVATAR_TONES = [
  'border-chart-1/60 bg-chart-1/45',
  'border-chart-2/60 bg-chart-2/45',
  'border-chart-3/60 bg-chart-3/45',
  'border-chart-4/60 bg-chart-4/45',
  'border-chart-5/60 bg-chart-5/45',
  'border-chart-6/60 bg-chart-6/45',
  'border-chart-7/60 bg-chart-7/45',
  'border-chart-8/60 bg-chart-8/45',
];

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
      <DropdownMenuTrigger aria-label={`Hesap: ${name}`} title={name} className={ACCOUNT_BUTTON}>
        <span className="hidden max-w-[16ch] truncate text-sm font-medium md:inline">{name}</span>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground hidden size-3.5 shrink-0 transition-transform group-data-popup-open:rotate-180 md:block"
        />
        <Avatar
          name={name}
          email={user.email}
          src={profilePictureSrc(user)}
          size="sm"
          className={cn('text-2xs size-8', AVATAR_TONES[avatarTone(name, user.email)])}
        />
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
