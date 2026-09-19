export type SidebarNavLink = Readonly<{ href: string; label: string }>;

export type SidebarNavNode =
  | Readonly<{ kind: 'link'; href: string; label: string }>
  | Readonly<{ kind: 'group'; id: string; label: string; children: readonly SidebarNavLink[] }>;
