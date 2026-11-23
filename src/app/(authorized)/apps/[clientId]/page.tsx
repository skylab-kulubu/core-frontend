'use client';

import { CopyButton, DataList, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { Lock, Plus, RefreshCw, X } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import {
  ObjectCard,
  ObjectEssentials,
  ObjectPage,
  ObjectPageHeader,
} from '@/components/chrome/object-page/ObjectPage';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import {
  appsApi,
  type AppAssignment,
  type AppAssignments,
  type AppAuditEntry,
} from '@/lib/api/apps';
import {
  auditActionText,
  auditSubtitle,
  formatInstant,
  inheritText,
  removalText,
} from '@/lib/app-assignments';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { matchesQuery } from '@/lib/list-query';
import { rolePlacementMessage } from '@/lib/role-placement';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useListParams } from '@/lib/ui/use-list-params';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCan } from '@/lib/use-app-can';
import { AddAssignmentDrawer } from '../_parts/AddAssignmentDrawer';
import {
  accessLabel,
  appHref,
  appSection,
  assignedBy,
  assignmentCount,
  assignmentView,
  assignmentWhere,
  type AppSection,
} from '../_parts/app-view';

const SECTION_LABELS: Record<AppSection, string> = {
  genel: 'Genel bakış',
  atamalar: 'Atamalar',
  denetim: 'Denetim kaydı',
};

const RECENT = 3;

const rowId = (row: AppAssignment) => `${row.type}:${row.id}:${row.role}`;

/**
 * An app (Entra's Enterprise app): Genel bakış, Atamalar (users and groups) and
 * Denetim kaydı. core decides every change; the code's rows (Privileged roots,
 * /ROLLER, service accounts) are shown locked with the reason written out.
 */
export default function AppPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = decodeURIComponent(params.clientId);
  const search = useSearchParams();
  const section = appSection(search?.get('bolum') ?? null);
  const router = useRouter();
  const capabilities = useCapabilities();
  const can = useAppCan(false);
  const canRead = can('apps.read');
  const canAssign = can('apps.assign');
  const canAudit = can('audit.read');
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [list, setList] = useListParams({ view: 'all' });
  const view = assignmentView(list.view);

  const [data, setData] = useState<AppAssignments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AppAuditEntry[] | null>(null);
  const [auditFailed, setAuditFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await appsApi.assignments(clientId));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Atamalar yüklenemedi'));
    }
    setAudit(null);
  }, [clientId]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  // The latest changes show on the overview too, so the record is read once the app is
  useEffect(() => {
    if (!canAudit || !data || audit !== null || auditFailed) return;
    appsApi
      .audit(clientId)
      .then((rows) => {
        setAudit(rows);
        setAuditFailed(false);
      })
      .catch(() => setAuditFailed(true));
  }, [canAudit, data, audit, auditFailed, clientId]);

  useChromeCrumbName(`/apps/${clientId}`, data?.app.name);

  if (capabilities.status === 'loading') return <PageSkeleton variant="detail" />;
  if (!canRead) return <Forbidden pageTitle="Uygulama" />;
  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Uygulama" />
        <EmptyState kind="failed" title={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!data) return <PageSkeleton variant="detail" />;

  const app = data.app;
  const rows = data.assignments;
  const codeRows = rows.filter((row) => row.area === 'code').length;
  const groups = rows.filter((row) => row.type === 'group').length;
  const people = rows.length - groups;
  const searched = rows.filter((row) =>
    matchesQuery(list.q, row.name, row.path, row.email, row.role),
  );
  const shown = searched.filter((row) => view === 'all' || row.type === view);
  const showSection = (next: AppSection, change: { view?: string } = {}) => {
    const href = appHref(app.clientId, next);
    const viewPart = change.view && change.view !== 'all' ? `view=${change.view}` : '';
    router.push(viewPart ? `${href}${href.includes('?') ? '&' : '?'}${viewPart}` : href);
  };

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

  const columns: DataListColumn<AppAssignment>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Ad',
      cell: (row) => (
        <DataListTitle
          title={row.name || row.path || row.id}
          subtitle={
            <span className={`block min-w-0 break-words ${TEXT_SECONDARY}`}>
              {row.area === 'code'
                ? rolePlacementMessage(row.reason)
                : [assignmentWhere(row), inheritText(row)].filter(Boolean).join(' · ') || '—'}
            </span>
          }
        />
      ),
    },
    {
      id: 'type',
      width: '4.5rem',
      from: 'sm',
      header: 'Tür',
      cell: (row) => (
        <span className="text-secondary-foreground text-[13px]/5">
          {row.type === 'group' ? 'Grup' : 'Kişi'}
        </span>
      ),
    },
    {
      id: 'role',
      width: '7.5rem',
      from: 'sm',
      header: 'Rol',
      cell: (row) => (
        <code className="text-secondary-foreground truncate font-mono text-xs">{row.role}</code>
      ),
    },
    {
      id: 'members',
      width: '4rem',
      from: 'md',
      align: 'end',
      header: 'Kişi',
      cell: (row) => (
        <span className="text-secondary-foreground text-sm tabular-nums">{row.members}</span>
      ),
    },
    ...(data.auditVisible
      ? [
          {
            id: 'by',
            width: '10rem',
            from: 'xl' as const,
            header: 'Atayan',
            cell: (row: AppAssignment) => {
              const by = assignedBy(row);
              return by ? (
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-[13px]/5">{by.name}</span>
                  <span className="text-subtle-foreground block truncate text-xs">{by.when}</span>
                </span>
              ) : (
                <span className="text-subtle-foreground text-[13px]/5">Kayıt yok</span>
              );
            },
          },
        ]
      : []),
    {
      id: 'actions',
      width: { base: 'auto', sm: '7.5rem' },
      align: 'end',
      label: 'Eylemler',
      interactive: true,
      cell: (row) =>
        row.area === 'code' ? (
          <span className="inline-flex items-center gap-1">
            <Lock aria-hidden className="text-subtle-foreground size-3.5" />
            <StatusChip kind="neutral" label="Kodda tanımlı" />
          </span>
        ) : canAssign ? (
          <ActionButton icon={X} label="Kaldır" onClick={() => remove(row)} />
        ) : null,
    },
  ];

  const recent = (audit ?? []).slice(0, RECENT);

  return (
    <ObjectPage
      header={
        <ObjectPageHeader
          eyebrow="Uygulama"
          title={app.name}
          section={section !== 'genel' ? SECTION_LABELS[section] : undefined}
          badges={<StatusChip kind="neutral" label={accessLabel(app)} />}
          meta={assignmentCount(app)}
        />
      }
      commands={
        <CommandBar label="Uygulama komutları">
          {canAssign ? (
            <Command primary icon={Plus} label="Ekle" onClick={() => setAdding(true)} />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      notices={
        error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null
      }
      menu={{
        label: 'Uygulama',
        sections: [
          {
            items: [
              { href: appHref(app.clientId), label: SECTION_LABELS.genel },
              {
                href: appHref(app.clientId, 'atamalar'),
                label: SECTION_LABELS.atamalar,
                badge: rows.length,
              },
              ...(canAudit
                ? [{ href: appHref(app.clientId, 'denetim'), label: SECTION_LABELS.denetim }]
                : []),
            ],
          },
        ],
        activeHref: appHref(app.clientId, section),
      }}
    >
      {section === 'atamalar' ? (
        <section aria-label="Atamalar" className="flex flex-col gap-3">
          <ListToolbar
            query={list.q}
            onQuery={(q) => setList({ q })}
            commitDelay={250}
            placeholder="Ad, yol ya da rol"
            searchLabel="Atama ara"
            viewsLabel="Atama türü"
            views={[
              { value: 'all', label: 'Hepsi', count: searched.length },
              {
                value: 'group',
                label: 'Gruplar',
                count: searched.filter((row) => row.type === 'group').length,
              },
              {
                value: 'user',
                label: 'Yalnız kişiler',
                count: searched.filter((row) => row.type === 'user').length,
              },
            ]}
            view={view}
            onView={(next) => setList({ view: next })}
          />
          {shown.length ? (
            <DataList
              columns={columns}
              rows={shown}
              getRowId={rowId}
              rowLabel={(row) => row.name || row.path || row.id}
            />
          ) : list.q.trim() || view !== 'all' ? (
            <EmptyState kind="no-results" onClear={() => setList({ q: '', view: 'all' })} />
          ) : (
            <EmptyState
              kind="first-use"
              title="Atama yok"
              action={
                canAssign ? (
                  <ActionButton
                    icon={Plus}
                    variant="primary"
                    label="Ekle"
                    onClick={() => setAdding(true)}
                  />
                ) : undefined
              }
            />
          )}
        </section>
      ) : section === 'denetim' && canAudit ? (
        <section aria-label="Denetim kaydı" className="flex flex-col gap-3">
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Son 100 kayıt</p>
          {auditFailed ? (
            <EmptyState
              kind="failed"
              title="Kayıt yüklenemedi"
              onRetry={() => setAuditFailed(false)}
            />
          ) : audit && !audit.length ? (
            <EmptyState kind="first-use" title="Kayıt yok" />
          ) : (
            <DataList
              columns={[
                {
                  id: 'what',
                  width: 'minmax(0,1fr)',
                  header: 'Değişiklik',
                  cell: (entry: AppAuditEntry) => (
                    <DataListTitle
                      title={`${entry.actor.name || 'Bilinmeyen kişi'} · ${auditActionText(entry)}`}
                      subtitle={<span className={TEXT_SECONDARY}>{auditSubtitle(entry)}</span>}
                    />
                  ),
                },
                {
                  id: 'outcome',
                  width: { base: 'auto', sm: '8rem' },
                  align: 'end',
                  label: 'Sonuç',
                  cell: (entry: AppAuditEntry) =>
                    entry.outcome === 'ok' ? null : (
                      <StatusChip
                        kind={entry.outcome === 'pending' ? 'pending' : 'cancelled'}
                        label={entry.outcome === 'pending' ? 'Bekliyor' : 'Olmadı'}
                      />
                    ),
                },
              ]}
              rows={audit ?? []}
              getRowId={(entry) => entry.id}
              loading={audit === null}
              skeletonRows={4}
            />
          )}
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <SummaryStrip
            label="Atama sayıları"
            items={[
              {
                key: 'group',
                label: 'Grup ataması',
                value: groups,
                onSelect: () => showSection('atamalar', { view: 'group' }),
              },
              {
                key: 'user',
                label: 'Kişi ataması',
                value: people,
                onSelect: () => showSection('atamalar', { view: 'user' }),
              },
              {
                key: 'code',
                label: 'Kodda tanımlı',
                value: codeRows,
                onSelect: () => showSection('atamalar'),
              },
            ]}
          />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ObjectEssentials
              items={[
                {
                  label: 'Uygulama kimliği',
                  value: (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <code className="truncate font-mono text-[13px]">{app.clientId}</code>
                      <CopyButton
                        value={app.clientId}
                        label="Kimliği kopyala"
                        variant="ghost"
                        size="icon-sm"
                      />
                    </span>
                  ),
                },
                { label: 'Erişim', value: accessLabel(app) },
                { label: 'Roller', value: app.roles.length ? app.roles.join(', ') : '—' },
                { label: 'Atama', value: assignmentCount(app) },
              ]}
            />
            {canAudit ? (
              <ObjectCard
                title="Son değişiklikler"
                href={appHref(app.clientId, 'denetim')}
                linkLabel="Tümü"
                linkName="Denetim kaydının tümü"
              >
                {recent.length ? (
                  <ul className="divide-border-subtle -my-1 divide-y">
                    {recent.map((entry) => (
                      <li key={entry.id} className="py-2">
                        <p className="text-foreground truncate text-sm">
                          {entry.actor.name || 'Bilinmeyen kişi'} · {auditActionText(entry)}
                        </p>
                        <p className={`text-subtle-foreground truncate ${TEXT_SECONDARY}`}>
                          {[entry.name || entry.path, entry.role, formatInstant(entry.occurredAt)]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : audit === null && !auditFailed ? null : (
                  <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                    {auditFailed ? 'Kayıt yüklenemedi' : 'Kayıt yok'}
                  </p>
                )}
              </ObjectCard>
            ) : null}
          </div>
        </div>
      )}
      <AddAssignmentDrawer
        app={app}
        open={adding}
        onClose={() => setAdding(false)}
        onAssigned={load}
      />
      {confirmDialog}
    </ObjectPage>
  );
}
