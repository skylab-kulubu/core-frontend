'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
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
import { Switch } from '@/components/chrome/Switch';
import { PickerDrawer, type PickerOption } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { GroupProfile } from '@/components/identity/GroupProfile';
import {
  UNVERIFIED_ADD_ACTION,
  UNVERIFIED_MARK,
  unverifiedAddText,
  unverifiedBatchText,
  warnsUnverified,
} from '@/components/identity/use-member-add';
import {
  MEMBER_CANDIDATE_HINT,
  MEMBER_CANDIDATE_MIN,
  usePickerSearch,
} from '@/components/identity/use-person-search';
import { ProblemError } from '@/lib/api/core';
import { identityApi, type ClientRole, type Group, type Person } from '@/lib/api/identity';
import {
  coreProblemMessage,
  groupDeleteProblemMessage,
  groupWriteProblemMessage,
} from '@/lib/core-problems';
import { isLeaderGroupPath, isPrivileged, isTeamGroupPath } from '@/lib/auth/groups';
import { useAuth } from '@/context/AuthContext';
import {
  TEAM_SETTING_ATTRS,
  extraGroupAttrs,
  isKnownGroupAttr,
  isTeamSettingAttr,
  membersManageCompetitors,
} from '@/lib/group-attrs';
import { memberSubtitle } from '@/lib/group-members';
import { matchesQuery } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { findManagedGroup, useManagedGroups } from '@/lib/managed-groups';
import { mapLimit } from '@/lib/map-limit';
import { pickerMatch, roleKey } from '@/lib/picker';
import {
  ROLES_ROOT,
  appAssignmentTarget,
  rolePlacement,
  rolePlacementMessage,
} from '@/lib/role-placement';
import { useAppCan } from '@/lib/use-app-can';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** core refused some of the confirmed adds; the message says who and why. */
class MembersRefused extends Error {}

/** No active account matched: the person signs up first (ticket 08; ticket 09's invite replaces it). */
const NO_CANDIDATE = "Kullanıcı yok. Kişinin önce my.yildizskylab.com'dan kaydolması gerekir.";

/** How many member checks (and address reads) run at once for a selection. */
const CHECKS_AT_ONCE = 3;

/** An address member-candidates masked (a***@example.com): the query was no whole address. */
function masked(email: string): boolean {
  return email.includes('***');
}

/**
 * The question before adding `people` when core warned of the ones in
 * `unverified` (id → the address to check). The description is left out when
 * none of them is unverified, as for a retry of a refused verified one.
 */
function unverifiedQuestion(
  people: readonly PickerOption[],
  unverified: ReadonlyMap<string, string>,
  groupName: string,
): { title: string; description: string | undefined } {
  const flagged = people.filter((person) => unverified.has(person.id));
  const title =
    people.length === 1
      ? `${people[0]!.title} ${groupName} grubuna eklensin mi?`
      : `${people.length} kişi ${groupName} grubuna eklensin mi?`;
  if (flagged.length === 0) return { title, description: undefined };
  if (people.length === 1)
    return { title, description: unverifiedAddText(unverified.get(people[0]!.id)!) };
  return {
    title,
    description: unverifiedBatchText(
      people.length,
      flagged.map((person) => ({ name: person.title, email: unverified.get(person.id)! })),
    ),
  };
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  // Ekiplerim opens this page under /my-teams (ticket 08): its trail stays there
  const base = usePathname()?.startsWith('/my-teams/') ? '/my-teams' : '/groups';
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  // A Team's Leader reads no role mappings (core: Privileged's); the section hides
  const [rolesReadable, setRolesReadable] = useState(true);
  // A Team setting is being saved: the switch waits for core's answer
  const [savingSettings, setSavingSettings] = useState(false);
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
  // core's candidate search: names, or a whole address; masked addresses; YTÜ warnings
  const memberSearch = usePickerSearch(
    memberOpen,
    memberQuery,
    (query) => identityApi.memberCandidates(id, query),
    MEMBER_CANDIDATE_MIN,
  );
  const [pickError, setPickError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // The YTÜ question opens over the Üye ekle drawer, so it has its own dialog
  const [confirmMembers, membersDialog] = useConfirm();
  const { user } = useAuth();
  // core's group.write decides every change here (a DK member reads only); the
  // group rule stands in only when the capabilities cannot be read
  const can = useAppCan(isPrivileged(user?.groups ?? []));
  const canWrite = can('group.write');
  const canReadUsers = can('user.read');
  // A Leader adds and removes members of a Team they manage: core's managed
  // tree says which (members.write); a Leader group's own row stays read-only
  const managedGroups = useManagedGroups();
  const managed =
    managedGroups.status === 'ready' ? findManagedGroup(managedGroups.groups, id) : undefined;
  const memberWrite = canWrite || managed?.can?.['members.write'] === true;
  // With core's app assignments on (ticket 15), a Team's, Sub-team's or Leader
  // group's app roles are given on Uygulamalar; here they only show
  const appsOn = useAppCan(false)('apps.read');
  // Only a role group's own subgroups matter to the placement rule: the path
  // they were read for, so a role group shows no "Rol ekle" before they are known
  const [subgroupsOf, setSubgroupsOf] = useState<{ path: string; has: boolean } | null>(null);

  async function load() {
    try {
      const [g, mem, mapped] = await Promise.all([
        identityApi.getGroup(id),
        identityApi.members(id),
        identityApi.groupRoles(id).catch((err: unknown) => {
          if (err instanceof ProblemError && err.status === 403) return null;
          throw err;
        }),
      ]);
      setGroup(g);
      setMembers(mem);
      setRoles(mapped ?? []);
      setRolesReadable(mapped !== null);
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

  useChromeCrumbName(`${base}/${id}`, group?.name);
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const mappedKeys = useMemo(() => new Set(roles.map(roleKey)), [roles]);
  // The Team's settings have their own switch below, not a row here
  const extraAttrs = Object.fromEntries(
    Object.entries(extraGroupAttrs(group?.attributes)).filter(
      ([key]) => !(TEAM_SETTING_ATTRS as readonly string[]).includes(key),
    ),
  );
  // Whoever manages the Team (its Leader, one above, Privileged) sets its own settings
  const settingsWrite = !!group && memberWrite && isTeamGroupPath(group.path);
  // Why core would refuse a new role here (null: it takes one); removing one is always allowed
  const placementKnown =
    !!group && (!group.path.startsWith(`${ROLES_ROOT}/`) || subgroupsOf?.path === group.path);
  const placement =
    group && placementKnown
      ? rolePlacement(group.path, subgroupsOf?.path === group.path && subgroupsOf.has)
      : null;
  const rolesOnApps = appsOn && !!group && appAssignmentTarget(group.path) === null;

  const memberOptions: PickerOption[] = memberSearch.people
    .filter(
      (person) =>
        !person.alreadyMember &&
        !memberIds.has(person.id) &&
        !(addedMembers.groupId === id && addedMembers.ids.has(person.id)),
    )
    .map((person) => ({
      id: person.id,
      title: `${person.firstName} ${person.lastName}`.trim() || person.email,
      subtitle: person.email,
      // Only core's warning marks a person: a Privileged Group and an account not verified with YTÜ
      marker: person.warnings.includes('not_ytu_verified') ? UNVERIFIED_MARK : undefined,
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
   * The ones core refuses stay selected; returns them with why, for the
   * caller to say in one place.
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
    if (failures.length === 0) setMemberOpen(false);
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
   *
   * The question names the address to check. The candidate search masks it
   * unless the reader typed it whole, so the person's card gives it then;
   * when the card cannot be read, the masked address stands.
   */
  async function addSelectedMembers() {
    if (memberSubmit.current || selectedMembers.length === 0) return;
    const people = selectedMembers;
    const unverified = await submitting(async () => {
      const warns = await mapLimit(people, CHECKS_AT_ONCE, (person) =>
        warnsUnverified(id, person.id),
      );
      const flagged = people.filter((_, index) => warns[index]);
      if (flagged.length === 0) {
        const failures = await addMembers(people, new Set());
        if (failures.length > 0) setPickError(failures.map((failure) => failure.text).join(' '));
        return new Map<string, string>();
      }
      const emails = await mapLimit(flagged, CHECKS_AT_ONCE, async (person) => {
        const shown = person.subtitle ?? '';
        if (!masked(shown)) return shown;
        return identityApi
          .getUser(person.id)
          .then((card) => card.email || shown)
          .catch(() => shown);
      });
      return new Map(flagged.map((person, index) => [person.id, emails[index]!]));
    });
    if (unverified.size === 0) return;
    const acked = new Set(unverified.keys());
    const groupName = group?.name ?? id;
    // A retry from the question adds, and names, only the ones core refused the last time
    let left = people;
    confirmMembers({
      ...unverifiedQuestion(people, unverified, groupName),
      actionLabel: UNVERIFIED_ADD_ACTION,
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
      afterFailure: () => unverifiedQuestion(left, unverified, groupName),
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
            memberWrite ? (
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
                // A Leader without users:read would get core's 403 on the person's card
                href={canReadUsers ? `/users/${m.id}` : undefined}
                title={`${m.firstName} ${m.lastName}`.trim() || m.email}
                subtitle={memberSubtitle(group?.path ?? '', m)}
                trailing={
                  canWrite || (memberWrite && !isLeaderGroupPath(m.sourceGroupPath)) ? (
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

      {settingsWrite && group ? (
        <section className="space-y-3">
          <SectionHeading title="Ekip ayarları" />
          {/* The panel is full width: a row this wide would part the label from its switch */}
          <div className="max-w-3xl">
            <Switch
              checked={membersManageCompetitors(group.attributes)}
              label="Üyeler yarışmacı ekleyip düzenleyebilir"
              hint="Kapalıysa yalnız liderler."
              disabled={savingSettings}
              onChange={async (next) => {
                if (savingSettings) return;
                setSavingSettings(true);
                try {
                  await identityApi.setTeamSettings(id, { membersManageCompetitors: next });
                  notify.success('Ayar kaydedildi');
                  await load();
                } catch (err) {
                  setError(coreProblemMessage(err, 'Ayar kaydedilemedi'));
                } finally {
                  setSavingSettings(false);
                }
              }}
            />
          </div>
        </section>
      ) : null}

      {rolesReadable ? (
        <section className="space-y-3">
          <SectionHeading
            title="Uygulama rolleri"
            meta={`${roles.length} rol`}
            actions={
              canWrite && placementKnown && !placement && !rolesOnApps ? (
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
          {rolesOnApps ? (
            <p className="text-3xs text-subtle-foreground">
              Uygulama rolleri{' '}
              <Link href="/apps" className="underline">
                Uygulamalar
              </Link>{' '}
              sayfasından atanır. Yönetici rolleri kodda tanımlı; burada yalnız görünür.
            </p>
          ) : canWrite && placement ? (
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
                  canWrite && !rolesOnApps ? (
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
      ) : null}

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
                setError(
                  isTeamSettingAttr(attrKey.trim())
                    ? 'Bu ayar yukarıdaki Ekip ayarları bölümünde.'
                    : 'Bu alan yukarıdaki kulüp alanlarında.',
                );
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
            {/* lg is the 36px of the boxes beside it */}
            <SaveButton size="lg" className="self-end">
              Ekle
            </SaveButton>
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
        placeholder="Ad veya tam e-posta"
        loading={memberSearch.loading}
        failed={memberSearch.failed}
        options={memberOptions}
        emptyMessage={memberSearch.ready ? NO_CANDIDATE : MEMBER_CANDIDATE_HINT}
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
