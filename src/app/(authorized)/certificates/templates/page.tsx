'use client';

import { Badge } from '@skylab-kulubu/skylcn-ui';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TemplateThumb } from '@/components/certificates/TemplateThumb';
import {
  shownLayout,
  useTemplateBackgrounds,
} from '@/components/certificates/use-template-backgrounds';
import { ListFooter, ListPage } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  certificatesApi,
  type CertificateTemplate,
  type CertificateTemplateBinding,
} from '@/lib/api/certificates';
import { canManageCertificateTemplates } from '@/lib/auth/groups';
import { defaultLabels, eventUses } from '@/lib/certificate-defaults';
import { coreProblemMessage } from '@/lib/core-problems';
import { matchesQuery } from '@/lib/list-query';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useListParams } from '@/lib/ui/use-list-params';
import { useAnyTeamCan } from '@/lib/use-app-can';

type View = 'all' | 'live' | 'draft';

const DAY = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' });

function published(template: CertificateTemplate): string | null {
  const at = template.publishedVersion?.publishedAt;
  if (!at) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : DAY.format(date);
}

export default function CertificateTemplatesPage() {
  const { user } = useAuth();
  // The group rule narrowed by core's certificateTemplate.create (a DK member reads only)
  const anyTeamCan = useAnyTeamCan();
  const canCreate =
    canManageCertificateTemplates(user?.groups ?? [], user?.roles ?? []) &&
    anyTeamCan('certificateTemplate.create');
  const [templates, setTemplates] = useState<CertificateTemplate[] | null>(null);
  const [bindings, setBindings] = useState<CertificateTemplateBinding[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [params, setParams] = useListParams({ view: 'all' });
  const view: View = params.view === 'live' || params.view === 'draft' ? params.view : 'all';

  const load = useCallback(() => {
    setFailed(null);
    Promise.all([
      certificatesApi.templates(),
      // Which template is whose default; the cards stand without it
      certificatesApi.bindings().catch(() => [] as CertificateTemplateBinding[]),
    ])
      .then(([rows, bound]) => {
        setTemplates(rows);
        setBindings(bound);
      })
      .catch((cause) => {
        setTemplates([]);
        setFailed(coreProblemMessage(cause, 'Şablonlar yüklenemedi'));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => templates ?? [], [templates]);
  const backgrounds = useTemplateBackgrounds(rows.map(shownLayout));
  const searched = rows.filter((row) => matchesQuery(params.q, row.name, row.ownerTeam));
  const live = searched.filter((row) => row.publishedVersion);
  const drafts = searched.filter((row) => !row.publishedVersion);
  const shown = view === 'live' ? live : view === 'draft' ? drafts : searched;

  if (templates === null) return <PageSkeleton variant="list" />;

  return (
    <ListPage
      title="Sertifika şablonları"
      commands={
        <CommandBar label="Şablon komutları">
          {canCreate ? (
            <Command
              primary
              icon={Plus}
              label="Şablon oluştur"
              href="/certificates/templates/new"
            />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={load} />
        </CommandBar>
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Ad ya da ekip"
          searchLabel="Şablon ara"
          views={[
            { value: 'all', label: 'Hepsi', count: searched.length },
            { value: 'live', label: 'Yayında', count: live.length },
            { value: 'draft', label: 'Taslak', count: drafts.length },
          ]}
          view={view}
          onView={(next) => setParams({ view: next })}
        />
      }
      footer={
        <ListFooter total={shown.length} page={1} totalPages={1} onPage={() => {}} noun="şablon" />
      }
    >
      {failed ? (
        <EmptyState kind="failed" title={failed} onRetry={load} />
      ) : !shown.length ? (
        params.q.trim() || view !== 'all' ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
        ) : (
          <EmptyState kind="first-use" title="Henüz şablon yok" />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((template) => {
            const layout = shownLayout(template);
            const defaults = defaultLabels(template.id, bindings);
            const events = eventUses(template.id, bindings);
            const date = published(template);
            return (
              <li key={template.id}>
                <Link
                  href={`/certificates/templates/${template.id}`}
                  className="bg-card border-border-subtle hover:border-border focus-visible:ring-ring flex h-full flex-col gap-3 rounded-lg border p-3 outline-hidden transition-colors focus-visible:ring-2"
                >
                  <TemplateThumb
                    layout={layout}
                    background={
                      layout.backgroundMediaId ? backgrounds[layout.backgroundMediaId] : null
                    }
                  />
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground-strong truncate text-sm font-semibold">
                        {template.name}
                      </p>
                      <p className={`text-secondary-foreground truncate ${TEXT_SECONDARY}`}>
                        {[template.ownerTeam || 'Kulüp geneli', date ? `${date} yayınlandı` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {template.publishedVersion ? (
                      <StatusChip
                        kind="active"
                        label={`Yayında · v${template.publishedVersion.version}`}
                      />
                    ) : (
                      <StatusChip kind="draft" label="Taslak" />
                    )}
                  </div>
                  {defaults.length || events || template.system ? (
                    <div className="flex flex-wrap gap-1">
                      {template.system ? (
                        <Badge tone="neutral" className="text-xs">
                          Sistem
                        </Badge>
                      ) : null}
                      {defaults.map((label) => (
                        <Badge key={label} tone="brand" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                      {events ? (
                        <Badge tone="neutral" className="text-xs">
                          {events} etkinlikte
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ListPage>
  );
}
