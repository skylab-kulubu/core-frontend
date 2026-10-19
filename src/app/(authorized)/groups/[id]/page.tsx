'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { PickerDrawer, type PickerOption } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { GroupProfile } from '@/components/identity/GroupProfile';
import { UNVERIFIED_ADD_TEXT, warnsUnverified } from '@/components/identity/use-member-add';
import { PERSON_SEARCH_HINT, usePersonSearch } from '@/components/identity/use-person-search';
import { identityApi, type ClientRole, type Group, type Person } from '@/lib/api/identity';
import {
  coreProblemMessage,
  groupDeleteProblemMessage,
  groupWriteProblemMessage,
} from '@/lib/core-problems';
import { isPrivileged } from '@/lib/auth/groups';
import { useAuth } from '@/context/AuthContext';
import { extraGroupAttrs, isKnownGroupAttr } from '@/lib/group-attrs';
import { memberSubtitle } from '@/lib/group-members';
import { matchesQuery } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { pickerMatch, roleKey } from '@/lib/picker';
import { ROLES_ROOT, rolePlacement, rolePlacementMessage } from '@/lib/role-placement';
import { useAppCan } from '@/lib/use-app-can';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** core refused some of the confirmed adds; the message says who and why. */
class MembersRefused extends Error {}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberOpen, setMemberOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<PickerOption[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const memberSubmit = useRef(false);
  const [addedMembers, setAddedMembers] = useState<{ groupId: string; ids: Set<string> }>({
    groupId: id,
    ids: new Set(),
  });
  const [roleOpen, setRoleOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberRosterQuery, setMemberRosterQuery] = useState('');
  const [roleQuery, setRoleQuery] = useState('');
  const [catalog, setCatalog] = useState<ClientRole[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFailed, setPickerFailed] = useState(false);
  const memberSearch = usePersonSearch(memberOpen, memberQuery);
  const [pickError, setPickError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // The YTÜ question opens over the Üye ekle drawer, so it has its own dialog
  const [confirmMembers, membersDialog] = useConfirm();
  const { user } = useAuth();
  // core's group.write decides every change here (a DK member reads only); the
  // group rule stands in only when the capabilities cannot be read
  const canWrite = useAppCan(isPrivileged(user?.groups ?? []))('group.write');
  // Only a role group's own subgroups matter to the placement rule: the path
  // they were read for, so a role group shows no "Rol ekle" before they are known
  const [subgroupsOf, setSubgroupsOf] = useState<{ path: string; has: boolean } | null>(null);

  async function load() {
    try {
      const [g, mem, mapped] = await Promise.all([
        identityApi.getGroup(id),
        identityApi.members(id),
        identityApi.groupRoles(id),
      ]);
      setGroup(g);
      setMembers(mem);
      setRoles(mapped);
      setError(null);
      if (g.path.startsWith(`${ROLES_ROOT}/`)) {
        // An unread list counts as none: core still refuses a mapping that breaks the rule
        const all = await identityApi.listGroups().catch(() => []);
        setSubgroupsOf({
          path: g.path,
          has: all.some((other) => other.path.startsWith(`${g.path}/`)),
        });
      }
    } catch (err) {
      setError(coreProblemMessage(err, 'Yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useChromeCrumbName(`/groups/${id}`, group?.name);
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const mappedKeys = useMemo(() => new Set(roles.map(roleKey)), [roles]);
  const extraAttrs = extraGroupAttrs(group?.attributes);
  // Why core would refuse a new role here (null: it takes one); removing one is always allowed
  const placementKnown =
    !!group && (!group.path.startsWith(`${ROLES_ROOT}/`) || subgroupsOf?.path === group.path);
  const placement =
    group && placementKnown
      ? rolePlacement(group.path, subgroupsOf?.path === group.path && subgroupsOf.has)
      : null;

  const memberOptions = memberSearch.people
    .filter(
      (person) =>
        !memberIds.has(person.id) &&
        !(addedMembers.groupId === id && addedMembers.ids.has(person.id)),
    )
    .map((person) => ({
      id: person.id,
      title: `${person.firstName} ${person.lastName}`.trim() || person.email,
      subtitle: person.email,
    }));

  const roleOptions = catalog
    .filter(
      (role) => !mappedKeys.has(roleKey(role)) && pickerMatch(roleQuery, role.role, role.clientId),
    )
    .map((role) => ({
      id: roleKey(role),
      title: role.role,
      subtitle: role.clientId,
    }));

  /** Holds the picker while `work` runs: one submission at a time, and the drawer stays open. */
  async function submitting<T>(work: () => Promise<T>): Promise<T> {
    memberSubmit.current = true;
    setAddingMembers(true);
    setPickError(null);
    try {
      return await work();
    } finally {
      memberSubmit.current = false;
      setAddingMembers(false);
    }
  }

  /**
   * Adds the people in order, sending unverifiedAck for the ones in `acked`.
   * The ones core refuses stay selected; returns them with why.
   */
  async function addMembers(
    people: PickerOption[],
    acked: ReadonlySet<string>,
  ): Promise<{ person: PickerOption; text: string }[]> {
    const failures: { person: PickerOption; text: string }[] = [];
    let added = 0;
    for (const person of people) {
      try {
        if (acked.has(person.id)) {
          await identityApi.addMember(id, person.id, { unverifiedAck: true });
        } else {
          await identityApi.addMember(id, person.id);
        }
        added += 1;
        setAddedMembers((current) => ({
          groupId: id,
          ids: new Set([...(current.groupId === id ? current.ids : []), person.id]),
        }));
        setSelectedMembers((current) => current.filter((row) => row.id !== person.id));
      } catch (err) {
        failures.push({
          person,
          text: `${person.title}: ${coreProblemMessage(err, 'Üye eklenemedi')}`,
        });
      }
    }
    if (added > 0) notify.success(added === 1 ? 'Üye eklendi' : `${added} üye eklendi`);
    if (failures.length > 0) setPickError(failures.map((failure) => failure.text).join(' '));
    else setMemberOpen(false);
    await load();
    return failures;
  }

  /**
   * Adds the selected people. When core warns that some are not verified
   * with YTÜ (a Privileged target, grup-yonetimi 07), it asks first and sends
   * the reader's confirmation as unverifiedAck; otherwise it adds at once.
   * The Group's Privileged state comes only from core's answer, never its
   * name, and a check that cannot be read only means no warning. Turning the
   * question down adds nobody and keeps the selection.
   */
  async function addSelectedMembers() {
    if (memberSubmit.current || selectedMembers.length === 0) return;
    const people = selectedMembers;
    const unverified = await submitting(async () => {
      const warns = await Promise.all(people.map((person) => warnsUnverified(id, person.id)));
      const flagged = people.filter((_, index) => warns[index]);
      if (flagged.length === 0) await addMembers(people, new Set());
      return flagged;
    });
    if (unverified.length === 0) return;
    const acked = new Set(unverified.map((person) => person.id));
    const groupName = group?.name ?? id;
    // A retry from the question adds only the ones core refused the last time
    let left = people;
    confirmMembers({
      title:
        people.length === 1
          ? `${people[0].title} ${groupName} grubuna eklensin mi?`
          : `${people.length} kişi ${groupName} grubuna eklensin mi?`,
      description:
        people.length === 1
          ? UNVERIFIED_ADD_TEXT
          : `YTÜ ile doğrulanmamış hesap: ${unverified
              .map((person) => person.title)
              .join(', ')}. Aynı adlı başka biri olmadığından emin olun.`,
      actionLabel: 'Yine de ekle',
      destructive: false,
      onConfirm: async () => {
        const failures = await submitting(() => addMembers(left, acked));
        left = failures.map((failure) => failure.person);
        if (failures.length > 0) {
          throw new MembersRefused(failures.map((failure) => failure.text).join(' '));
        }
      },
      failure: (err) =>
        err instanceof MembersRefused ? err.message : coreProblemMessage(err, 'Üye eklenemedi'),
      closesDrawer: true,
    });
  }

  if (error && !group) {
    return <StateCard title={error} description="Grup kartına dönemiyor." tone="danger" />;
  }
  if (loading && !group) return <StateCard title="Yükleniyor…" isLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={group?.name ?? id}
        description={group?.path}
        meta={<span className="text-2xs text-subtle-foreground">{members.length} üye</span>}
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {group ? (
        <GroupProfile
          group={group}
          readOnly={!canWrite}
          onSave={async (next) => {
            try {
              await identityApi.updateGroup(id, next);
              notify.success('Grup kaydedildi');
              await load();
            } catch (err) {
              setError(groupWriteProblemMessage(err, 'save', 'Kaydedilemedi'));
            }
          }}
        />
      ) : null}

      <section className="space-y-3">
        <SectionHeading
          title="Üyeler"
          meta={`${members.length} kişi`}
          actions={
            canWrite ? (
              <ActionButton
                icon={Plus}
                variant="primary"
                label="Üye ekle"
                onClick={() => {
                  setMemberQuery('');
                  setSelectedMembers([]);
                  setPickError(null);
                  setMemberOpen(true);
                }}
              />
            ) : null
          }
        />
        <ListToolbar
          query={memberRosterQuery}
          onQuery={setMemberRosterQuery}
          placeholder="Ad veya e-posta"
          searchLabel="Üye ara"
        />
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: members.filter((m) =>
              matchesQuery(memberRosterQuery, m.firstName, m.lastName, m.email),
            ).length,
            emptyMessage: memberRosterQuery.trim() ? 'Eşleşen üye yok' : 'Üye yok',
          })}
          emptyDescription="Üye ekle veya aramayı temizle."
        >
          {members
            .filter((m) => matchesQuery(memberRosterQuery, m.firstName, m.lastName, m.email))
            .map((m) => (
              <ListItem
                key={m.id}
                href={`/users/${m.id}`}
                title={`${m.firstName} ${m.lastName}`.trim() || m.email}
                subtitle={memberSubtitle(group?.path ?? '', m)}
                trailing={
                  canWrite ? (
                    <ActionButton
                      icon={X}
                      label="Çıkar"
                      onClick={() =>
                        confirm({
                          title: `${`${m.firstName} ${m.lastName}`.trim() || m.email} ${group?.name ?? ''} grubundan çıkarılsın mı?`,
                          description:
                            'Kişi bu grubun rollerini ve erişimlerini kaybeder. Bu ona e-postayla bildirilir. Yönetim gruplarındaki değişiklik ayrıca yöneticilere bildirilir.',
                          actionLabel: 'Gruptan çıkar',
                          onConfirm: async () => {
                            await identityApi.removeMember(id, m.id);
                            setAddedMembers((current) => {
                              if (current.groupId !== id) return current;
                              const remaining = new Set(current.ids);
                              remaining.delete(m.id);
                              return { groupId: id, ids: remaining };
                            });
                            notify.success('Üye çıkarıldı');
                            await load();
                          },
                          failure: 'Üye çıkarılamadı',
                        })
                      }
                    />
                  ) : null
                }
              />
            ))}
        </ListPanel>
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Uygulama rolleri"
          meta={`${roles.length} rol`}
          actions={
            canWrite && placementKnown && !placement ? (
              <ActionButton
                icon={Plus}
                variant="primary"
                label="Rol ekle"
                onClick={async () => {
                  setRoleQuery('');
                  setPickError(null);
                  setRoleOpen(true);
                  setPickerLoading(true);
                  try {
                    setCatalog(await identityApi.listClientRoles());
                    setPickerFailed(false);
                  } catch {
                    setPickerFailed(true);
                  } finally {
                    setPickerLoading(false);
                  }
                }}
              />
            ) : null
          }
        />
        {canWrite && placement ? (
          <p className="text-3xs text-subtle-foreground">
            {rolePlacementMessage(placement)}
            {roles.length > 0 ? ' Bu gruptaki roller yalnız kaldırılabilir.' : ''}
          </p>
        ) : null}
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: roles.length,
            emptyMessage: 'Client rol yok',
          })}
        >
          {roles.map((r) => (
            <ListItem
              key={roleKey(r)}
              title={r.role}
              subtitle={r.clientId}
              trailing={
                canWrite ? (
                  <ActionButton
                    icon={X}
                    label="Kaldır"
                    onClick={() =>
                      confirm({
                        title: `${r.role} rolü ${group?.name ?? ''} grubundan kaldırılsın mı?`,
                        description: 'Grubun bütün üyeleri bu rolü kaybeder.',
                        actionLabel: 'Rolü kaldır',
                        onConfirm: async () => {
                          await identityApi.setGroupRoles(
                            id,
                            roles.filter((x) => x.clientId !== r.clientId || x.role !== r.role),
                          );
                          notify.success('Rol kaldırıldı');
                          await load();
                        },
                        failure: 'Rol kaldırılamadı',
                      })
                    }
                  />
                ) : null
              }
            />
          ))}
        </ListPanel>
      </section>

      <section className="space-y-3">
        <SectionHeading title="Ekstra öznitelikler" />
        <p className="text-3xs text-subtle-foreground">
          Kulüp alanları yukarıda. Buraya yalnızca ekstra bir anahtar lazımsa yaz.
        </p>
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: Object.keys(extraAttrs).length,
            emptyMessage: 'Ekstra öznitelik yok',
          })}
        >
          {Object.entries(extraAttrs).map(([k, v]) => (
            <ListItem
              key={k}
              title={v}
              subtitle={k}
              trailing={
                canWrite ? (
                  <ActionButton
                    icon={X}
                    label="Kaldır"
                    onClick={() =>
                      confirm({
                        title: `${k} özniteliği kaldırılsın mı?`,
                        description: `Değeri (${v}) gruptan silinir.`,
                        actionLabel: 'Özniteliği kaldır',
                        onConfirm: async () => {
                          const next = { ...(group?.attributes ?? {}) };
                          delete next[k];
                          await identityApi.updateGroup(id, { attributes: next });
                          notify.success('Öznitelik kaldırıldı');
                          await load();
                        },
                        failure: 'Öznitelik kaldırılamadı',
                      })
                    }
                  />
                ) : null
              }
            />
          ))}
        </ListPanel>
        {canWrite ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!attrKey.trim()) return;
              if (isKnownGroupAttr(attrKey.trim())) {
                setError('Bu alan yukarıdaki kulüp alanlarında.');
                return;
              }
              try {
                await identityApi.updateGroup(id, {
                  attributes: { ...(group?.attributes ?? {}), [attrKey.trim()]: attrValue },
                });
                setAttrKey('');
                setAttrValue('');
                notify.success('Öznitelik eklendi');
                await load();
              } catch (err) {
                setError(coreProblemMessage(err, 'Öznitelik eklenemedi'));
              }
            }}
          >
            <label className="block space-y-1">
              <FieldLabel>Anahtar</FieldLabel>
              <Field
                className="w-40"
                value={attrKey}
                onChange={(e) => setAttrKey(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <FieldLabel>Değer</FieldLabel>
              <Field
                className="w-40"
                value={attrValue}
                onChange={(e) => setAttrValue(e.target.value)}
              />
            </label>
            <SaveButton className="self-end">Ekle</SaveButton>
          </form>
        ) : null}
      </section>

      {group && canWrite ? (
        <section className="space-y-3">
          <SectionHeading
            title="Grubu sil"
            actions={
              <ActionButton
                icon={Trash2}
                label="Grubu sil"
                onClick={() =>
                  confirm({
                    title: `${group.name} silinsin mi?`,
                    description:
                      'Yalnız üyesi, alt grubu ve bağlı kaydı olmayan gruplar silinebilir. Silme geri alınamaz. Kontroller geçtikten sonra grup kodu kalıcı olarak ayrılır; silme tamamlanmasa bile aynı grupta tekrar deneyebilirsin.',
                    actionLabel: 'Grubu sil',
                    onConfirm: async () => {
                      await identityApi.deleteGroup(group.id);
                      notify.success('Grup silindi');
                      router.push('/groups');
                    },
                    failure: groupDeleteProblemMessage,
                  })
                }
              />
            }
          />
          <p className="text-subtle-foreground text-sm">
            Sistem ve rol grupları korunur. Üyeler veya alt gruplar kendiliğinden silinmez.
          </p>
        </section>
      ) : null}
      {confirmDialog}
      <PickerDrawer
        open={memberOpen}
        onClose={() => {
          if (!memberSubmit.current) setMemberOpen(false);
        }}
        title="Üye ekle"
        query={memberQuery}
        onQuery={setMemberQuery}
        placeholder="Ad, e-posta"
        loading={memberSearch.loading}
        failed={memberSearch.failed}
        options={memberOptions}
        emptyMessage={memberSearch.ready ? 'Kullanıcı yok' : PERSON_SEARCH_HINT}
        error={pickError}
        selection={{
          items: selectedMembers,
          onChange: setSelectedMembers,
          onSubmit: addSelectedMembers,
          busy: addingMembers,
          submitLabel: 'Seçilenleri ekle',
        }}
      >
        {membersDialog}
      </PickerDrawer>
      <PickerDrawer
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        title="Rol ekle"
        query={roleQuery}
        onQuery={setRoleQuery}
        placeholder="Client veya rol"
        loading={pickerLoading}
        failed={pickerFailed}
        options={roleOptions}
        emptyMessage="Rol yok"
        error={pickError}
        onPick={async (picked) => {
          const role = catalog.find((row) => roleKey(row) === picked);
          if (!role) return;
          setPickError(null);
          try {
            await identityApi.setGroupRoles(id, [...roles, role]);
            setRoleOpen(false);
            notify.success('Rol eklendi');
            await load();
          } catch (err) {
            setPickError(coreProblemMessage(err, 'Rol eklenemedi'));
          }
        }}
      />
    </div>
  );
}
