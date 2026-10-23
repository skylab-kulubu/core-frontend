'use client';

import { Tab, Tabs, TabsList, TabsPanel } from '@skylab-kulubu/skylcn-ui';
import { Lock, Plus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import {
  MEMBER_CANDIDATE_HINT,
  MEMBER_CANDIDATE_MIN,
  usePickerSearch,
} from '@/components/identity/use-person-search';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import {
  appsApi,
  type AppAssignment,
  type AppAssignments,
  type AppAuditEntry,
  type AppTarget,
  type AppTargetType,
} from '@/lib/api/apps';
import {
  PERSON_ASSIGNMENT_HINT,
  assignmentSubtitle,
  auditActionText,
  auditSubtitle,
  initialRoles,
  removalText,
  targetSubtitle,
} from '@/lib/app-assignments';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { listStatus } from '@/lib/list-status';
import { rolePlacementMessage } from '@/lib/role-placement';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCan } from '@/lib/use-app-can';

/** The longest note core keeps with a change. */
const NOTE_MAX = 200;

type PageTab = 'assignments' | 'audit';

/**
 * An app's "Kullanıcılar ve gruplar" (Entra's Enterprise app → Users and
 * groups) and its audit tab. core decides every change; the code's rows
 * (Privileged roots, /ROLLER, service accounts) are shown locked.
 */
export default function AppAssignmentsPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = decodeURIComponent(params.clientId);
  const capabilities = useCapabilities();
  const can = useAppCan(false);
  const canRead = can('apps.read');
  const canAssign = can('apps.assign');
  const canAudit = can('audit.read');
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  const [data, setData] = useState<AppAssignments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PageTab>('assignments');
  const [peopleOnly, setPeopleOnly] = useState(false);
  const [audit, setAudit] = useState<AppAuditEntry[] | null>(null);
  const [auditFailed, setAuditFailed] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [targetType, setTargetType] = useState<AppTargetType>('group');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<AppTarget | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const searching = addOpen && !target;
  const groupSearch = usePickerSearch(
    searching && targetType === 'group',
    query,
    (q) => appsApi.targets(clientId, 'group', q),
    0,
  );
  const userSearch = usePickerSearch(
    searching && targetType === 'user',
    query,
    (q) => appsApi.targets(clientId, 'user', q),
    MEMBER_CANDIDATE_MIN,
  );
  const search = targetType === 'group' ? groupSearch : userSearch;

  async function load() {
    try {
      setData(await appsApi.assignments(clientId));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Atamalar yüklenemedi'));
    }
    setAudit(null);
  }

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, clientId]);

  useEffect(() => {
    if (tab !== 'audit' || audit !== null || !canAudit) return;
    appsApi
      .audit(clientId)
      .then((rows) => {
        setAudit(rows);
        setAuditFailed(false);
      })
      .catch(() => setAuditFailed(true));
  }, [tab, audit, canAudit, clientId]);

  useChromeCrumbName(`/apps/${clientId}`, data?.app.name);

  if (capabilities.status === 'loading') return <StateCard title="Yükleniyor…" isLoading />;
  if (!canRead) return <StateCard title="Uygulama atamaları açık değil" />;
  if (error && !data) return <StateCard title={error} tone="danger" />;
  if (!data) return <StateCard title="Yükleniyor…" isLoading />;

  const app = data.app;
  const rows = data.assignments.filter((row) => !peopleOnly || row.type === 'user');

  function openAdd() {
    setTargetType('group');
    setQuery('');
    setTarget(null);
    setRoles([]);
    setNote('');
    setAddError(null);
    setAddOpen(true);
  }

  function pick(next: AppTarget) {
    setTarget(next);
    setRoles(initialRoles(app.suggestedRoles, next));
    setAddError(null);
  }

  /** Assigns each chosen role in turn; the ones core refuses are said in the drawer. */
  async function assign() {
    if (!target || roles.length === 0 || saving) return;
    setSaving(true);
    setAddError(null);
    const failures: string[] = [];
    let done = 0;
    for (const role of roles) {
      try {
        await appsApi.assign(clientId, {
          type: target.type,
          id: target.id,
          role,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        done += 1;
      } catch (err) {
        failures.push(`${role}: ${coreProblemMessage(err, 'Atanamadı')}`);
      }
    }
    setSaving(false);
    if (done > 0) notify.success(done === 1 ? 'Atandı' : `${done} rol atandı`);
    if (failures.length > 0) setAddError(failures.join(' '));
    else setAddOpen(false);
    await load();
  }

  function remove(row: AppAssignment) {
    confirm({
      title: `${row.role}, ${row.name || row.path || row.id} için kaldırılsın mı?`,
      description: removalText(row),
      actionLabel: 'Atamayı kaldır',
      onConfirm: async () => {
        await appsApi.unassign(clientId, { type: row.type, id: row.id, role: row.role });
        notify.success('Atama kaldırıldı');
        await load();
      },
      failure: 'Atama kaldırılamadı',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.name}
        description={app.clientId}
        meta={
          <span className="text-2xs text-subtle-foreground">
            Atama gerekli: {app.assignmentRequired ? 'Evet' : 'Hayır'}
          </span>
        }
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as PageTab)}>
        <TabsList>
          <Tab value="assignments">Kullanıcılar ve gruplar</Tab>
          {canAudit ? <Tab value="audit">Denetim</Tab> : null}
        </TabsList>
        <TabsPanel value="assignments" className="space-y-3 pt-3">
          <SectionHeading
            title="Atamalar"
            meta={`${app.groups} grup · ${app.users} kişi`}
            actions={
              canAssign ? (
                <ActionButton icon={Plus} variant="primary" label="Ekle" onClick={openAdd} />
              ) : null
            }
          />
          <Switch
            checked={peopleOnly}
            onChange={setPeopleOnly}
            label="Yalnız kişiler"
            hint="Doğrudan kişiye yapılan atamalar"
          />
          <ListPanel
            status={listStatus({
              loading: false,
              failed: false,
              rowCount: rows.length,
              emptyMessage: peopleOnly ? 'Kişiye atama yok' : 'Atama yok',
            })}
          >
            {rows.map((row) => (
              <ListItem
                key={`${row.type}:${row.id}:${row.role}`}
                title={row.name || row.path || row.id}
                subtitle={assignmentSubtitle(row, data.auditVisible)}
                trailing={
                  row.area === 'code' ? (
                    <span
                      className="inline-flex items-center gap-1"
                      title={rolePlacementMessage(row.reason)}
                    >
                      <Lock aria-hidden className="size-3.5" />
                      <StatusChip kind="neutral" label="Kodda tanımlı" />
                    </span>
                  ) : canAssign ? (
                    <ActionButton icon={X} label="Kaldır" onClick={() => remove(row)} />
                  ) : null
                }
              />
            ))}
          </ListPanel>
        </TabsPanel>
        {canAudit ? (
          <TabsPanel value="audit" className="space-y-3 pt-3">
            <SectionHeading title="Son değişiklikler" meta="Son 100 kayıt" />
            <ListPanel
              status={listStatus({
                loading: audit === null && !auditFailed,
                failed: auditFailed,
                rowCount: audit?.length ?? 0,
                emptyMessage: 'Kayıt yok',
              })}
            >
              {(audit ?? []).map((entry) => (
                <ListItem
                  key={entry.id}
                  title={`${entry.actor.name || 'Bilinmeyen kişi'} · ${auditActionText(entry)}`}
                  subtitle={auditSubtitle(entry)}
                />
              ))}
            </ListPanel>
          </TabsPanel>
        ) : null}
      </Tabs>
      {confirmDialog}
      <Drawer
        open={addOpen}
        onClose={() => {
          if (!saving) setAddOpen(false);
        }}
        title="Ekle"
      >
        <Tabs
          value={targetType}
          onValueChange={(value) => {
            setTargetType(value as AppTargetType);
            setQuery('');
            setTarget(null);
          }}
        >
          <TabsList>
            <Tab value="group">Grup</Tab>
            <Tab value="user">Kişi</Tab>
          </TabsList>
        </Tabs>
        {targetType === 'user' ? (
          <p className="text-3xs text-subtle-foreground">{PERSON_ASSIGNMENT_HINT}</p>
        ) : null}
        {target ? (
          <div className="space-y-3">
            <ListItem
              title={target.name || target.path || target.id}
              subtitle={targetSubtitle(target)}
              trailing={
                <ActionButton
                  icon={X}
                  label="Seçimi kaldır"
                  disabled={saving}
                  onClick={() => setTarget(null)}
                />
              }
            />
            <fieldset className="space-y-2">
              <legend>
                <FieldLabel>Rol</FieldLabel>
              </legend>
              {app.roles.map((role) => {
                const held = target.assignedRoles.includes(role);
                return (
                  <label key={role} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      disabled={saving || held}
                      checked={held || roles.includes(role)}
                      onChange={(event) =>
                        setRoles((current) =>
                          event.target.checked
                            ? [...current, role]
                            : current.filter((row) => row !== role),
                        )
                      }
                    />
                    <span>{held ? `${role} (atanmış)` : role}</span>
                  </label>
                );
              })}
            </fieldset>
            <label className="block space-y-1">
              <FieldLabel>Not (isteğe bağlı)</FieldLabel>
              <TextArea
                value={note}
                maxLength={NOTE_MAX}
                disabled={saving}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <p className="text-3xs text-subtle-foreground">Kişisel bilgi yazma.</p>
            {addError ? (
              <p role="alert" className="text-destructive text-sm">
                {addError}
              </p>
            ) : null}
            <SaveButton
              type="button"
              disabled={saving || roles.length === 0}
              onClick={() => void assign()}
            >
              {saving ? 'Atanıyor…' : 'Ata'}
            </SaveButton>
          </div>
        ) : (
          <>
            <Field
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                targetType === 'group' ? 'Ekip, alt ekip ya da yol' : 'Ad veya tam e-posta'
              }
              aria-label={targetType === 'group' ? 'Grup ara' : 'Kişi ara'}
            />
            <ListPanel
              status={listStatus({
                loading: search.loading,
                failed: search.failed,
                rowCount: search.people.length,
                emptyMessage:
                  targetType === 'user' && !search.ready
                    ? MEMBER_CANDIDATE_HINT
                    : targetType === 'group'
                      ? 'Grup yok'
                      : 'Kullanıcı yok',
              })}
            >
              {search.people.map((option) => (
                <ListItem
                  key={option.id}
                  title={option.name || option.path || option.id}
                  subtitle={targetSubtitle(option)}
                  onSelect={() => pick(option)}
                />
              ))}
            </ListPanel>
          </>
        )}
      </Drawer>
    </div>
  );
}
