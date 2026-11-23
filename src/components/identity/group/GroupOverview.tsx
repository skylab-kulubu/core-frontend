'use client';

import { CopyButton } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ObjectCard, ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { useGroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import { identityApi, type TeamAuditRecord } from '@/lib/api/identity';
import {
  GROUP_KIND_LABELS,
  auditActionLabel,
  groupKind,
  groupSectionHref,
  memberRole,
  type GroupSection,
} from '@/lib/group-page';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** One figure of the Group that opens the page it counts (Entra's clickable counts). */
function CountCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card border-border-subtle hover:border-border flex min-w-0 flex-col gap-1 rounded-lg border p-3 transition-colors sm:p-4"
    >
      <span className={`text-subtle-foreground font-medium ${TEXT_SECONDARY}`}>{label}</span>
      <span className="text-foreground-strong text-2xl leading-none font-semibold tabular-nums">
        {value}
      </span>
      {hint ? <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{hint}</span> : null}
    </Link>
  );
}

/**
 * Genel bakış: the Group's key facts, its figures (each opening its page) and,
 * for whoever reads the audit record, the latest changes.
 */
export function GroupOverview() {
  const { id, base, group, members, leaders, roles, rolesReadable, managed, isTeam, canReadAudit } =
    useGroupWorkspace();
  const [recent, setRecent] = useState<TeamAuditRecord[] | null>(null);

  useEffect(() => {
    if (!canReadAudit) return;
    let live = true;
    identityApi
      .groupAudit(id, { limit: 5 })
      .then((page) => live && setRecent(page.items ?? []))
      .catch(() => live && setRecent(null));
    return () => {
      live = false;
    };
  }, [id, canReadAudit]);

  const href = (section: GroupSection) => groupSectionHref(base, id, section);
  const leaderRows = members.filter((m) => memberRole(m, leaders) !== 'member').length;
  const leaderCount = managed?.leaderCount ?? leaderRows;
  const subTeams = managed?.children?.length ?? 0;
  const attrs = group.attributes ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Üye" value={members.length} href={href('members')} />
        {isTeam && managed ? (
          <>
            <CountCard label="Lider" value={leaderCount} href={href('leaders')} />
            <CountCard label="Alt ekip" value={subTeams} href={href('leaders')} />
          </>
        ) : leaderRows > 0 ? (
          <CountCard label="Lider" value={leaderRows} href={`${href('members')}?view=leaders`} />
        ) : null}
        {rolesReadable ? (
          <CountCard label="Uygulama rolü" value={roles.length} href={href('roles')} />
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ObjectEssentials
          editHref={href('settings')}
          editName="Grup ayarlarını aç"
          items={[
            { label: 'Kod', value: group.name },
            { label: 'Tür', value: GROUP_KIND_LABELS[groupKind(group.path)] },
            ...(attrs.display_name_tr
              ? [{ label: 'Görünen ad', value: attrs.display_name_tr }]
              : []),
            ...(attrs.display_name_en
              ? [{ label: 'İngilizce ad', value: attrs.display_name_en }]
              : []),
            {
              label: 'Yol',
              value: (
                <span className="flex min-w-0 items-center gap-1">
                  <span className="min-w-0 break-all">{group.path}</span>
                  <CopyButton
                    value={group.path}
                    label="Yolu kopyala"
                    variant="ghost"
                    size="icon-sm"
                  />
                </span>
              ),
            },
            ...(attrs.description_tr ? [{ label: 'Açıklama', value: attrs.description_tr }] : []),
          ]}
        />
        {recent ? (
          <ObjectCard title="Son değişiklikler" href={href('audit')} linkName="Denetim kaydını aç">
            {recent.length ? (
              <ul className="divide-border-subtle flex flex-col divide-y">
                {recent.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm">
                        {auditActionLabel(row.action)}
                        {row.target?.displayName ? `: ${row.target.displayName}` : ''}
                      </span>
                      <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                        {row.actor?.displayName || 'Sistem'}
                      </span>
                    </span>
                    <span className={`text-subtle-foreground shrink-0 ${TEXT_SECONDARY}`}>
                      {formatApplicantWhen(row.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Kayıt yok</p>
            )}
          </ObjectCard>
        ) : null}
      </div>
    </div>
  );
}
