'use client';

import { Badge, Button, Card, Notice } from '@skylab-kulubu/skylcn-ui';
import { ChevronRight, LogOut, Pencil, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { ClientRole, UserCard, UserProfilePatch } from '@/lib/api/identity';
import { roleKey } from '@/lib/picker';
import { profilePictureSrc } from '@/lib/profile-picture';
import { groupTrail, rolesByApp } from '@/lib/user-directory';
import { UserProfileForm } from './UserProfileForm';

type UserCardViewProps = {
  card: UserCard;
  canEditProfile?: boolean;
  canReadFull?: boolean;
  /** Saves the profile; false keeps the form open with what was typed. */
  onSaveProfile?: (patch: UserProfilePatch) => boolean | void | Promise<boolean | void>;
  /** Why the last profile save was refused, said beside its Kaydet. */
  profileError?: string | null;
  onAddGroup?: () => void;
  onRemoveRole?: (role: ClientRole) => void;
  onLogout?: () => void;
  /** More buttons beside Düzenle and Oturumları kapat. */
  actions?: ReactNode;
  /** More subjects, each a CardSection, after Yetkiler. */
  sections?: ReactNode;
  /** Subjects as wide as the page, each a CardSection, after the cards. */
  wideSections?: ReactNode;
};

/** One subject of the person card: a titled card with its own actions. */
export function CardSection({
  id,
  title,
  count,
  actions,
  className,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className={`space-y-3 p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold">
          {title}
          {count !== undefined ? (
            <span className="text-subtle-foreground ml-1 font-normal tabular-nums">{count}</span>
          ) : null}
        </h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}

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
    <dl className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] content-start gap-x-4 gap-y-2 text-sm">
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
        <ul aria-label="Gruptan gelen roller" className="space-y-2">
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
          <ul aria-label="Doğrudan roller" className="mt-2 space-y-1.5">
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

/**
 * The person card: who, then a card per subject (Profil, Gruplar, Yetkiler).
 * More subjects come as their own cards through `sections`, more actions through `actions`.
 */
export function UserCardView(props: UserCardViewProps) {
  const {
    card,
    canEditProfile,
    canReadFull,
    onSaveProfile,
    onAddGroup,
    onRemoveRole,
    onLogout,
    actions,
    sections,
    wideSections,
    profileError,
  } = props;
  const [editing, setEditing] = useState(false);
  const groups = card.groups ?? [];
  const inherited = card.inheritedRoles ?? [];
  const extra = card.extraRoles ?? [];
  const save = onSaveProfile
    ? async (patch: UserProfilePatch) => {
        // A refused save keeps the form and what was typed; the reason shows at Kaydet
        if ((await onSaveProfile(patch)) !== false) setEditing(false);
      }
    : undefined;

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
            {actions}
          </>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Count label="Grup" value={groups.length} href="#gruplar" />
        <Count label="Rol" value={inherited.length} href="#yetkiler" />
        <Count label="Doğrudan rol" value={extra.length} href="#yetkiler" tone="warning" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSection title="Profil" className="self-start">
          {editing && canEditProfile ? (
            <UserProfileForm card={card} onSave={save} error={profileError} className="grid gap-3">
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                Vazgeç
              </Button>
            </UserProfileForm>
          ) : (
            <Facts rows={facts(card, canReadFull)} />
          )}
        </CardSection>
        <div className="space-y-4">
          <CardSection
            id="gruplar"
            title="Gruplar"
            count={groups.length}
            actions={
              onAddGroup ? (
                <Button size="xs" variant="outline" onClick={onAddGroup}>
                  <Plus className="size-3.5" />
                  Grup ekle
                </Button>
              ) : null
            }
          >
            <GroupList card={card} />
          </CardSection>
          <CardSection id="yetkiler" title="Yetkiler">
            <RoleList card={card} onRemoveRole={onRemoveRole} />
          </CardSection>
          {sections}
        </div>
      </div>
      {wideSections}
    </div>
  );
}
