'use client';

import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
  MenuItem,
  Notice,
  Tab,
  Tabs,
  TabsList,
  TabsPanel,
} from '@skylab-kulubu/skylcn-ui';
import { ChevronRight, LogOut, MoreHorizontal, Pencil, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { ClientRole, UserCard, UserProfilePatch } from '@/lib/api/identity';
import { roleKey } from '@/lib/picker';
import { profilePictureSrc } from '@/lib/profile-picture';
import type { DesignVariant } from '@/lib/ui/design-variant';
import { groupTrail, rolesByApp } from '@/lib/user-directory';
import { UserProfileForm } from './UserProfileForm';

type UserCardDesignProps = {
  variant: DesignVariant;
  card: UserCard;
  canEditProfile?: boolean;
  canReadFull?: boolean;
  onSaveProfile?: (patch: UserProfilePatch) => void | Promise<void>;
  onAddGroup?: () => void;
  onRemoveRole?: (role: ClientRole) => void;
  onLogout?: () => void;
};

function facts(card: UserCard, canReadFull?: boolean): { label: string; value: string }[] {
  const dash = (value?: string) => (value ?? '').trim() || '—';
  const rows = [
    { label: 'Üniversite', value: dash(card.university) },
    { label: 'Fakülte', value: dash(card.faculty) },
    { label: 'Bölüm', value: dash(card.department) },
    { label: 'LinkedIn', value: dash(card.linkedin) },
  ];
  if (canReadFull) rows.push({ label: 'Telefon', value: dash(card.phone) });
  if (card.studentCardUid) rows.push({ label: 'Öğrenci kartı UID', value: card.studentCardUid });
  return rows;
}

function Facts({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-secondary-foreground truncate">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Trail({ path }: { path: string }) {
  const parts = groupTrail(path);
  return (
    <span className="flex min-w-0 items-center gap-1 text-sm">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1">
          {index ? <ChevronRight className="text-subtle-foreground size-3 shrink-0" /> : null}
          <span
            className={
              index === parts.length - 1
                ? 'text-foreground-strong truncate font-medium'
                : 'text-muted-foreground truncate'
            }
          >
            {part}
          </span>
        </span>
      ))}
    </span>
  );
}

function GroupList({ card }: { card: UserCard }) {
  const groups = card.groups ?? [];
  if (!groups.length) return <p className="text-subtle-foreground text-sm">Grup yok</p>;
  return (
    <ul className="divide-border-subtle divide-y">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${encodeURIComponent(group.id)}`}
            className="hover:bg-accent group/row -mx-2 flex items-center gap-2 rounded-md px-2 py-2"
          >
            <Trail path={group.path} />
            <ChevronRight className="text-muted-foreground group-hover/row:text-skylab-300 ml-auto size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RoleList({
  card,
  onRemoveRole,
}: {
  card: UserCard;
  onRemoveRole?: (role: ClientRole) => void;
}) {
  const inherited = rolesByApp(card.inheritedRoles ?? []);
  const extra = card.extraRoles ?? [];
  return (
    <div className="space-y-4">
      {inherited.length ? (
        <ul className="space-y-2">
          {inherited.map((entry) => (
            <li key={entry.app} className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground w-24 shrink-0 text-xs">{entry.app}</span>
              {entry.roles.map((role) => (
                <Badge key={role} tone="neutral">
                  {role}
                </Badge>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-subtle-foreground text-sm">Gruptan gelen rol yok</p>
      )}
      {extra.length ? (
        <Notice tone="warning" title={`Doğrudan rol: ${extra.length}`}>
          <ul className="mt-2 space-y-1.5">
            {extra.map((role) => (
              <li key={roleKey(role)} className="flex items-center gap-2">
                <span className="text-muted-foreground w-24 shrink-0 text-xs">{role.clientId}</span>
                <Badge tone="warning">{role.role}</Badge>
                {onRemoveRole ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => onRemoveRole(role)}
                  >
                    <X className="size-3.5" />
                    Kaldır
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}

function Count({
  label,
  value,
  href,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: 'warning';
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="text-2xs text-subtle-foreground font-medium">{label}</span>
      <span
        className={`text-xl leading-none font-semibold tabular-nums ${
          tone === 'warning' && value ? 'text-warning' : 'text-foreground-strong'
        }`}
      >
        {value}
      </span>
    </>
  );
  const className =
    'bg-card border-border-subtle hover:border-border-strong flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors';
  if (href)
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function Header({
  card,
  actions,
  size = 'lg',
}: {
  card: UserCard;
  actions?: ReactNode;
  size?: 'lg' | 'md';
}) {
  const name = `${card.firstName ?? ''} ${card.lastName ?? ''}`.trim() || card.email;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Avatar
        name={name}
        email={card.email}
        src={profilePictureSrc(card)}
        size={size}
        className={size === 'lg' ? 'size-16 text-lg' : undefined}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-foreground-strong truncate text-xl font-semibold">{name}</h1>
        <p className="text-muted-foreground truncate text-sm">{card.email}</p>
        <div className="flex flex-wrap gap-1.5">
          {card.skyNumber ? <StatusChip kind="member" label={card.skyNumber} /> : null}
          {card.schoolEmail ? <StatusChip kind="neutral" label={card.schoolEmail} /> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** The person card in a trial direction: A one page in cards, B tabs. */
export function UserCardDesign(props: UserCardDesignProps) {
  const {
    variant,
    card,
    canEditProfile,
    canReadFull,
    onSaveProfile,
    onAddGroup,
    onRemoveRole,
    onLogout,
  } = props;
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('genel');
  const groups = card.groups ?? [];
  const inherited = card.inheritedRoles ?? [];
  const extra = card.extraRoles ?? [];
  const save = onSaveProfile
    ? async (patch: UserProfilePatch) => {
        await onSaveProfile(patch);
        setEditing(false);
      }
    : undefined;

  if (variant === 'a') {
    return (
      <div className="space-y-6">
        <Header
          card={card}
          actions={
            <>
              {canEditProfile && !editing ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  Düzenle
                </Button>
              ) : null}
              {onLogout ? (
                <Button size="sm" variant="outline" onClick={onLogout}>
                  <LogOut className="size-4" />
                  Oturumları kapat
                </Button>
              ) : null}
            </>
          }
        />
        <div className="grid grid-cols-3 gap-3">
          <Count label="Grup" value={groups.length} href="#gruplar" />
          <Count label="Rol" value={inherited.length} href="#yetkiler" />
          <Count label="Doğrudan rol" value={extra.length} href="#yetkiler" tone="warning" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-4">
            <h2 className="text-foreground text-sm font-semibold">Profil</h2>
            {editing && canEditProfile ? (
              <UserProfileForm card={card} onSave={save} className="grid gap-3">
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                  Vazgeç
                </Button>
              </UserProfileForm>
            ) : (
              <Facts rows={facts(card, canReadFull)} />
            )}
          </Card>
          <div className="space-y-4">
            <Card id="gruplar" className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-foreground text-sm font-semibold">
                  Gruplar{' '}
                  <span className="text-subtle-foreground font-normal tabular-nums">
                    {groups.length}
                  </span>
                </h2>
                {onAddGroup ? (
                  <Button size="xs" variant="outline" onClick={onAddGroup}>
                    <Plus className="size-3.5" />
                    Grup ekle
                  </Button>
                ) : null}
              </div>
              <GroupList card={card} />
            </Card>
            <Card id="yetkiler" className="space-y-3 p-4">
              <h2 className="text-foreground text-sm font-semibold">Yetkiler</h2>
              <RoleList card={card} onRemoveRole={onRemoveRole} />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        card={card}
        size="md"
        actions={
          canEditProfile || onLogout ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<IconButton icon={MoreHorizontal} variant="outline" label="Eylemler" />}
              />
              <DropdownMenuContent align="end">
                {canEditProfile ? (
                  <MenuItem
                    icon={Pencil}
                    onClick={() => {
                      setTab('profil');
                      setEditing(true);
                    }}
                  >
                    Profili düzenle
                  </MenuItem>
                ) : null}
                {onAddGroup ? (
                  <MenuItem icon={Plus} onClick={onAddGroup}>
                    Grup ekle
                  </MenuItem>
                ) : null}
                {onLogout ? (
                  <MenuItem icon={LogOut} onClick={onLogout}>
                    Oturumları kapat
                  </MenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
        <TabsList aria-label="Kişi kartı">
          <Tab value="genel">Genel bakış</Tab>
          <Tab value="profil">Profil</Tab>
          <Tab value="gruplar">
            Gruplar
            <span className="text-3xs text-subtle-foreground ml-1.5 tabular-nums">
              {groups.length}
            </span>
          </Tab>
          <Tab value="roller">
            Roller
            <span className="text-3xs text-subtle-foreground ml-1.5 tabular-nums">
              {inherited.length + extra.length}
            </span>
          </Tab>
        </TabsList>
        <TabsPanel value="genel" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Facts rows={facts(card, canReadFull)} />
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              <Count label="Grup" value={groups.length} onClick={() => setTab('gruplar')} />
              <Count label="Rol" value={inherited.length} onClick={() => setTab('roller')} />
              <Count
                label="Doğrudan rol"
                value={extra.length}
                tone="warning"
                onClick={() => setTab('roller')}
              />
            </div>
          </div>
        </TabsPanel>
        <TabsPanel value="profil" className="max-w-md pt-4">
          {canEditProfile && editing ? (
            <UserProfileForm card={card} onSave={save} className="grid gap-3">
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                Vazgeç
              </Button>
            </UserProfileForm>
          ) : (
            <div className="space-y-4">
              <Facts rows={facts(card, canReadFull)} />
              {canEditProfile ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  Düzenle
                </Button>
              ) : null}
            </div>
          )}
        </TabsPanel>
        <TabsPanel value="gruplar" className="max-w-2xl space-y-3 pt-4">
          {onAddGroup ? (
            <Button size="sm" variant="outline" onClick={onAddGroup}>
              <Plus className="size-4" />
              Grup ekle
            </Button>
          ) : null}
          <GroupList card={card} />
        </TabsPanel>
        <TabsPanel value="roller" className="max-w-2xl pt-4">
          <RoleList card={card} onRemoveRole={onRemoveRole} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
