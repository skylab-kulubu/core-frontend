'use client';

import { DataList, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { useGroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import { identityApi, type ClientRole } from '@/lib/api/identity';
import { coreProblemMessage } from '@/lib/core-problems';
import { pickerMatch, roleKey } from '@/lib/picker';
import {
  ROLES_ROOT,
  appAssignmentTarget,
  rolePlacement,
  rolePlacementMessage,
} from '@/lib/role-placement';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useAppCan } from '@/lib/use-app-can';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/**
 * Uygulama rolleri: the client roles mapped to the Group. Privileged writers add
 * and remove them where core's placement rule allows; with core's app assignments
 * on, a Team's roles are given on Uygulamalar and only show here.
 */
export function GroupRoles() {
  const { id, group, roles, rolesReadable, canWrite, reload } = useGroupWorkspace();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const appsOn = useAppCan(false)('apps.read');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<ClientRole[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFailed, setPickerFailed] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  // Only a role group's own subgroups matter to the placement rule: the path
  // they were read for, so a role group shows no "Rol ekle" before they are known
  const [subgroupsOf, setSubgroupsOf] = useState<{ path: string; has: boolean } | null>(null);

  useEffect(() => {
    if (!group.path.startsWith(`${ROLES_ROOT}/`)) return;
    let live = true;
    // An unread list counts as none: core still refuses a mapping that breaks the rule
    identityApi
      .listGroups()
      .catch(() => [])
      .then((all) => {
        if (!live) return;
        setSubgroupsOf({
          path: group.path,
          has: all.some((other) => other.path.startsWith(`${group.path}/`)),
        });
      });
    return () => {
      live = false;
    };
  }, [group.path]);

  const mappedKeys = useMemo(() => new Set(roles.map(roleKey)), [roles]);
  // Why core would refuse a new role here (null: it takes one); removing one is always allowed
  const placementKnown =
    !group.path.startsWith(`${ROLES_ROOT}/`) || subgroupsOf?.path === group.path;
  const placement = placementKnown
    ? rolePlacement(group.path, subgroupsOf?.path === group.path && subgroupsOf.has)
    : null;
  const rolesOnApps = appsOn && appAssignmentTarget(group.path) === null;
  const adds = canWrite && placementKnown && !placement && !rolesOnApps;

  const options = catalog
    .filter(
      (role) => !mappedKeys.has(roleKey(role)) && pickerMatch(query, role.role, role.clientId),
    )
    .map((role) => ({ id: roleKey(role), title: role.role, subtitle: role.clientId }));

  async function openPicker() {
    setQuery('');
    setPickError(null);
    setOpen(true);
    setPickerLoading(true);
    try {
      setCatalog(await identityApi.listClientRoles());
      setPickerFailed(false);
    } catch {
      setPickerFailed(true);
    } finally {
      setPickerLoading(false);
    }
  }

  const columns: DataListColumn<ClientRole>[] = [
    {
      id: 'role',
      width: 'minmax(0,1fr)',
      header: 'Rol',
      cell: (r) => (
        <DataListTitle
          title={r.role}
          subtitle={<span className={TEXT_SECONDARY}>{r.clientId}</span>}
        />
      ),
    },
    ...(canWrite && !rolesOnApps
      ? [
          {
            id: 'actions',
            width: '2.5rem',
            label: 'Eylemler',
            interactive: true,
            align: 'end' as const,
            cell: (r: ClientRole) => (
              <ActionButton
                icon={X}
                label="Kaldır"
                onClick={() =>
                  confirm({
                    title: `${r.role} rolü ${group.name} grubundan kaldırılsın mı?`,
                    description: 'Grubun bütün üyeleri bu rolü kaybeder.',
                    actionLabel: 'Rolü kaldır',
                    onConfirm: async () => {
                      await identityApi.setGroupRoles(
                        id,
                        roles.filter((x) => x.clientId !== r.clientId || x.role !== r.role),
                      );
                      notify.success('Rol kaldırıldı');
                      await reload();
                    },
                    failure: 'Rol kaldırılamadı',
                  })
                }
              />
            ),
          },
        ]
      : []),
  ];

  if (!rolesReadable) return <Forbidden />;

  return (
    <div className="flex flex-col gap-3">
      {adds ? (
        <CommandBar label="Rol komutları">
          <Command primary icon={Plus} label="Rol ekle" onClick={() => void openPicker()} />
        </CommandBar>
      ) : null}
      {rolesOnApps ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          Uygulama rolleri{' '}
          <Link href="/apps" className="underline">
            Uygulamalar
          </Link>{' '}
          sayfasından atanır; yönetici rolleri buradan değişmez.
        </p>
      ) : canWrite && placement ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          {rolePlacementMessage(placement)}
          {roles.length > 0 ? ' Bu gruptaki roller yalnız kaldırılabilir.' : ''}
        </p>
      ) : null}
      {roles.length ? (
        <DataList columns={columns} rows={roles} getRowId={roleKey} />
      ) : (
        <EmptyState kind="first-use" title="Uygulama rolü yok" />
      )}
      {confirmDialog}
      <PickerDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Rol ekle"
        query={query}
        onQuery={setQuery}
        placeholder="Client veya rol"
        loading={pickerLoading}
        failed={pickerFailed}
        options={options}
        emptyMessage="Rol yok"
        error={pickError}
        onPick={async (picked) => {
          const role = catalog.find((row) => roleKey(row) === picked);
          if (!role) return;
          setPickError(null);
          try {
            await identityApi.setGroupRoles(id, [...roles, role]);
            setOpen(false);
            notify.success('Rol eklendi');
            await reload();
          } catch (err) {
            setPickError(coreProblemMessage(err, 'Rol eklenemedi'));
          }
        }}
      />
    </div>
  );
}
