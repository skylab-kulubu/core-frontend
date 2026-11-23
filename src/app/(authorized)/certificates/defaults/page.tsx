'use client';

import { DataList, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { Link2, Pencil, Unlink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TemplateThumbBox } from '@/components/certificates/TemplateThumb';
import {
  shownLayout,
  useTemplateBackgrounds,
} from '@/components/certificates/use-template-backgrounds';
import { ListPage } from '@/components/chrome/ListPage';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { SaveButton } from '@/components/chrome/SaveButton';
import { SidePanel } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  certificatesApi,
  type CertificateTemplate,
  type CertificateTemplateBinding,
} from '@/lib/api/certificates';
import { teamsApi } from '@/lib/api/teams';
import { isPrivileged, ownerLevels } from '@/lib/auth/groups';
import { useCapabilities } from '@/lib/capabilities-context';
import { CLUB_SCOPE_KEY, defaultRows, type DefaultRow } from '@/lib/certificate-defaults';
import { coreProblemMessage } from '@/lib/core-problems';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import { useTeamCan } from '@/lib/use-app-can';

const DAY = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' });

function changedOn(raw?: string): string {
  if (!raw) return '—';
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? '—' : DAY.format(at);
}

export default function CertificateDefaultsPage() {
  const { user } = useAuth();
  const groups = useMemo(() => user?.groups ?? [], [user?.groups]);
  const privileged = isPrivileged(groups);
  const teamCan = useTeamCan();
  const capabilities = useCapabilities();
  const coreTeamNames =
    capabilities.status === 'ready'
      ? (capabilities.data.teams ?? []).map((row) => row.team).join('\n')
      : '';
  const coreTeams = useMemo(
    () => (coreTeamNames ? coreTeamNames.split('\n') : []),
    [coreTeamNames],
  );
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [bindings, setBindings] = useState<CertificateTemplateBinding[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string>();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  // Read once; core's answer arriving later only widens the list, it reads nothing again
  useEffect(() => {
    Promise.all([certificatesApi.templates(), certificatesApi.bindings(), teamsApi.list()])
      .then(([templateRows, bindingRows, teamRows]) => {
        setTemplates(templateRows.filter((item) => item.publishedVersion));
        setBindings(bindingRows);
        setTeamNames(teamRows.map((item) => item.team));
      })
      .catch((cause) => setFailed(coreProblemMessage(cause, 'Varsayılanlar yüklenemedi')))
      .finally(() => setLoading(false));
  }, []);
  const teams = useMemo(
    () =>
      teamNames.filter(
        (ownerTeam) =>
          privileged ||
          ownerLevels(groups, ownerTeam).length > 0 ||
          // a Sub-team led from above: core lists it among the caller's teams
          coreTeams.includes(ownerTeam),
      ),
    [teamNames, privileged, groups, coreTeams],
  );
  const rows = useMemo(
    () => defaultRows(teams, bindings, privileged),
    [teams, bindings, privileged],
  );
  const byId = useMemo(() => new Map(templates.map((row) => [row.id, row])), [templates]);
  const backgrounds = useTemplateBackgrounds(templates.map(shownLayout));
  const open = rows.find((row) => row.key === openKey) ?? null;
  const clubTemplate = byId.get(
    rows.find((row) => row.scope === 'club')?.binding?.templateId ?? '',
  );

  /** core's certificateTemplate.assign for the row: a DK member sees the defaults and changes none. */
  function canAssign(row: DefaultRow) {
    return teamCan(row.scope === 'club' ? '' : row.key, 'certificateTemplate.assign');
  }

  function choices(row: DefaultRow) {
    return templates.filter(
      (template) =>
        template.ownerTeam === '' || (row.scope === 'ownerTeam' && template.ownerTeam === row.key),
    );
  }

  function openRow(row: DefaultRow) {
    setOpenKey(row.key);
    setChoice(row.binding?.templateId ?? '');
    setSaveError(undefined);
  }

  async function save(row: DefaultRow) {
    setSaving(true);
    setSaveError(undefined);
    try {
      const updated = await certificatesApi.setBinding({
        scope: row.scope,
        scopeKey: row.scope === 'club' ? CLUB_SCOPE_KEY : row.key,
        templateId: choice,
      });
      setBindings((current) => [
        ...current.filter(
          (binding) => !(binding.scope === updated.scope && binding.scopeKey === updated.scopeKey),
        ),
        updated,
      ]);
      notify.success(
        row.scope === 'club'
          ? 'SKY LAB varsayılanı güncellendi'
          : `${row.key} varsayılanı güncellendi`,
      );
      setOpenKey(null);
    } catch (cause) {
      setSaveError(coreProblemMessage(cause, 'Varsayılan güncellenemedi'));
    } finally {
      setSaving(false);
    }
  }

  function askClear(team: string) {
    confirm({
      title: `${team} varsayılanı kaldırılsın mı?`,
      description: `${team} etkinlikleri, kendine özel şablonu olmayanlarda SKY LAB varsayılanını kullanır.`,
      actionLabel: 'Varsayılanı kaldır',
      onConfirm: async () => {
        await certificatesApi.clearBinding('ownerTeam', team);
        setBindings((current) =>
          current.filter(
            (binding) => !(binding.scope === 'ownerTeam' && binding.scopeKey === team),
          ),
        );
        setOpenKey(null);
        notify.success(`${team} varsayılanı kaldırıldı; SKY LAB varsayılanı geçerli.`);
      },
      failure: 'Varsayılan kaldırılamadı',
    });
  }

  if (loading) return <PageSkeleton variant="list" />;

  const columns: DataListColumn<DefaultRow>[] = [
    {
      id: 'scope',
      width: { base: 'minmax(0,7rem)', sm: 'minmax(0,12rem)' },
      header: 'Kapsam',
      cell: (row) => (
        <DataListTitle
          title={row.label}
          subtitle={
            <span className={TEXT_SECONDARY}>{row.scope === 'club' ? 'Kulüp' : 'Ekip'}</span>
          }
        />
      ),
    },
    {
      id: 'template',
      width: 'minmax(0,1fr)',
      header: 'Şablon',
      cell: (row) => {
        const template = byId.get(row.binding?.templateId ?? '');
        if (!template) {
          return (
            <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
              {row.scope === 'club'
                ? 'Seçilmedi'
                : `Kulüp varsayılanı${clubTemplate ? `: ${clubTemplate.name}` : ''}`}
            </span>
          );
        }
        const layout = shownLayout(template);
        return (
          <span className="flex min-w-0 items-center gap-3">
            <TemplateThumbBox
              layout={layout}
              background={layout.backgroundMediaId ? backgrounds[layout.backgroundMediaId] : null}
              className="h-10 w-14 shrink-0"
            />
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm">{template.name}</span>
              <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                v{template.publishedVersion?.version}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'changed',
      width: '9rem',
      from: 'md',
      header: 'Son değişiklik',
      cell: (row) => (
        <span className="text-secondary-foreground text-[13px]/5">
          {changedOn(row.binding?.updatedAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      width: '6.5rem',
      from: 'sm',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (row) =>
        canAssign(row) ? (
          <Command icon={Pencil} label="Değiştir" onClick={() => openRow(row)} />
        ) : null,
    },
  ];

  return (
    <ListPage
      title="Sertifika varsayılanları"
      toolbar={
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Sıra: etkinlik → ekip → kulüp</p>
      }
    >
      {failed ? (
        <EmptyState kind="failed" title={failed} onRetry={() => window.location.reload()} />
      ) : (
        <DataList
          columns={columns}
          rows={rows}
          getRowId={(row) => row.key}
          rowLabel={(row) => row.label}
          // On a phone the row itself opens its panel; the written action is for wide screens
          onRowSelect={(row) => (canAssign(row) ? openRow(row) : undefined)}
        />
      )}
      {confirmDialog}
      <SidePanel
        open={Boolean(open)}
        title={open ? `${open.label} varsayılanı` : ''}
        onClose={() => setOpenKey(null)}
        dirty={Boolean(open) && choice !== (open?.binding?.templateId ?? '')}
      >
        {open ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-secondary-foreground mb-2 text-[13px]/5 font-medium">
                Yayınlanmış şablon
              </legend>
              {choices(open).length ? (
                choices(open).map((template) => {
                  const layout = shownLayout(template);
                  return (
                    <label
                      key={template.id}
                      className="border-border-subtle has-[:checked]:border-skylab-600/60 has-[:checked]:ring-skylab-600/25 flex cursor-pointer items-center gap-3 rounded-md border p-2 has-[:checked]:ring-2"
                    >
                      <input
                        type="radio"
                        name="default-template"
                        value={template.id}
                        checked={choice === template.id}
                        onChange={() => setChoice(template.id)}
                        className="accent-skylab-400"
                      />
                      <TemplateThumbBox
                        layout={layout}
                        background={
                          layout.backgroundMediaId ? backgrounds[layout.backgroundMediaId] : null
                        }
                        className="h-14 w-20 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="text-foreground block truncate text-sm">
                          {template.name}
                        </span>
                        <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                          {template.ownerTeam || 'Kulüp geneli'} · v
                          {template.publishedVersion?.version}
                        </span>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Yayınlanmış şablon yok</p>
              )}
            </fieldset>
            {saveError ? (
              <p role="alert" className="text-destructive text-sm">
                {saveError}
              </p>
            ) : null}
            <CommandBar label="Varsayılan komutları">
              <SaveButton
                type="button"
                disabled={saving || !choice || choice === open.binding?.templateId}
                onClick={() => void save(open)}
              >
                <Link2 className="size-4" aria-hidden /> Varsayılan yap
              </SaveButton>
              {open.scope === 'ownerTeam' && open.binding ? (
                <Command
                  icon={Unlink}
                  label="Kulüp varsayılanını kullan"
                  onClick={() => askClear(open.key)}
                />
              ) : null}
            </CommandBar>
            {open.binding ? (
              <StatusChip
                kind="neutral"
                label={`Şu an: ${byId.get(open.binding.templateId)?.name ?? '—'}`}
              />
            ) : null}
          </>
        ) : null}
      </SidePanel>
    </ListPage>
  );
}
