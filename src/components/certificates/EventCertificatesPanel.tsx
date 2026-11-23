'use client';

import {
  DataList,
  DataListTitle,
  MenuItem,
  Skeleton,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  ExternalLink,
  Eye,
  FileBadge,
  RefreshCw,
  RotateCcw,
  Send,
  UserPlus,
} from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { RowMenu, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard, ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState } from '@/components/chrome/PageState';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { SidePanel } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { matchesQuery } from '@/lib/list-query';
import { pickerMatch } from '@/lib/picker';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  certificatesApi,
  type CertificateBatch,
  type CertificateEventSummary,
  type CertificateTemplate,
  type IssuedCertificate,
} from '@/lib/api/certificates';
import { coreProblemMessage } from '@/lib/core-problems';
import type { Ticket } from '@/lib/api/tickets';
import { listStatus } from '@/lib/list-status';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

const sourceLabel = (source: string | undefined, ownerTeam: string) => {
  if (source === 'event') return 'Etkinliğe özel';
  if (source === 'ownerTeam') {
    const team = ownerTeam === 'YK' || ownerTeam === 'DK' || !ownerTeam ? 'SKY LAB' : ownerTeam;
    return `${team} varsayılanı`;
  }
  return 'SKY LAB varsayılanı';
};

const WHEN = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

function when(raw?: string): string {
  if (!raw) return '—';
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? '—' : WHEN.format(at);
}

type IssuedView = 'all' | 'valid' | 'revoked';

const batchReasonLabel: Record<CertificateBatch['reason'], string> = {
  finalization: 'Katılım kapatma',
  manual: 'Manuel verme',
  reissue: 'Yeniden verme',
};

/** Batches with failed jobs, newest first: what "Yeniden dene" can act on. */
export function failedBatches(batches: readonly CertificateBatch[]): CertificateBatch[] {
  return batches
    .filter((batch) => batch.failedCount > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function ticketLabel(ticket: Ticket) {
  if (ticket.owner) return `${ticket.owner.firstName} ${ticket.owner.lastName}`.trim();
  const guest = `${ticket.guestFirstName ?? ''} ${ticket.guestLastName ?? ''}`.trim();
  return guest || ticket.guestEmail || ticket.ownerId || ticket.id;
}

export function EventCertificatesPanel({
  eventId,
  ownerTeam,
  attendanceRule,
  attendanceRatio,
  finalizeOpen,
  tickets,
  canIssue,
  canBind,
  canRevoke,
  canReadIssued,
  ruleHref,
}: {
  /** Where the rule is changed (the edit page's Sertifika section), for who may edit the event. */
  ruleHref?: string;
  eventId: string;
  ownerTeam: string;
  attendanceRule: string;
  attendanceRatio?: number;
  finalizeOpen: boolean;
  tickets: Ticket[];
  canIssue: boolean;
  canBind: boolean;
  canRevoke: boolean;
  canReadIssued: boolean;
}) {
  const [summary, setSummary] = useState<CertificateEventSummary>();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);
  const [failed, setFailed] = useState<CertificateBatch[]>([]);
  const [failedUnread, setFailedUnread] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');
  const [binding, setBinding] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<IssuedView>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // A count the organizer reads stays on the tab; a plain "it went through" is a toast
  const [message, setMessage] = useState<string>();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  /** A write went through: the earlier error and queue line are stale now. */
  const settled = (line?: string) => {
    setError(undefined);
    setMessage(line);
  };
  const done = (toast: string) => {
    settled();
    notify.success(toast);
  };

  const availableTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.publishedVersion && (!template.ownerTeam || template.ownerTeam === ownerTeam),
      ),
    [ownerTeam, templates],
  );

  async function load() {
    setLoading(true);
    try {
      const [nextSummary, nextTemplates, nextIssued] = await Promise.all([
        certificatesApi.summary(eventId),
        canBind ? certificatesApi.templates() : Promise.resolve([]),
        canReadIssued ? certificatesApi.listIssued(eventId) : Promise.resolve([]),
      ]);
      // Only read the batches when something failed: retrying is what they are for here,
      // and a failed read keeps the rest of the tab
      const nextBatches =
        canIssue && nextSummary.failedCount > 0
          ? await certificatesApi.listBatches(eventId).catch(() => null)
          : [];
      setSummary(nextSummary);
      setTemplates(nextTemplates);
      setIssued(nextIssued);
      setFailed(failedBatches(nextBatches ?? []));
      setFailedUnread(nextBatches === null);
      setTemplateId(nextSummary.resolution.template.id);
      setError(undefined);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Sertifika bilgileri yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [canBind, canIssue, canReadIssued, eventId]);

  async function issueTo(ticketId: string) {
    setBusy(true);
    try {
      await certificatesApi.issue(eventId, ticketId);
      done('Manuel sertifika üretim kuyruğuna alındı');
      setPicking(false);
      await load();
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Sertifika kuyruğa alınamadı'));
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    try {
      const blob = await certificatesApi.previewEvent(eventId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Önizleme üretilemedi'));
    }
  }

  function askFinalize(eligible: number) {
    confirm({
      title: 'Katılım kapatılıp sertifikalar üretilsin mi?',
      description: `Katılım kuralına uyan ${eligible} kişiye sertifika üretilir ve e-postayla gönderilir. Geri alınamaz: katılım kapandıktan sonra açılmaz, giden e-posta geri çekilmez.`,
      actionLabel: 'Katılımı kapat ve üret',
      onConfirm: async () => {
        setBusy(true);
        try {
          const batch = await certificatesApi.finalize(eventId);
          settled(`${batch.totalCount} sertifika üretim kuyruğuna alındı.`);
          await load();
        } finally {
          setBusy(false);
        }
      },
      failure: 'Katılım kapatılamadı',
    });
  }

  function askRevoke(certificate: IssuedCertificate) {
    confirm({
      title: `${certificate.recipientName} sertifikası iptal edilsin mi?`,
      description: `Doğrulama sayfası ${certificate.serial} için "iptal edildi" gösterir. İptal geri alınamaz; gerekirse Yeniden ver yeni bir üretim başlatır.`,
      actionLabel: 'Sertifikayı iptal et',
      onConfirm: async () => {
        setBusy(true);
        try {
          await certificatesApi.revoke(certificate.serial);
          done(`${certificate.recipientName} sertifikası iptal edildi`);
          await load();
        } finally {
          setBusy(false);
        }
      },
      failure: 'Sertifika iptal edilemedi',
    });
  }

  async function reissue(certificate: IssuedCertificate) {
    setBusy(true);
    setError(undefined);
    try {
      await certificatesApi.reissue(certificate.serial);
      done(`${certificate.recipientName} sertifikası yeniden üretim kuyruğuna alındı`);
      await load();
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Sertifika yeniden verilemedi'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const searched = issued.filter((row) => matchesQuery(query, row.recipientName, row.serial));
  const validRows = searched.filter((row) => !row.revokedAt);
  const revokedRows = searched.filter((row) => row.revokedAt);
  const shown = view === 'valid' ? validRows : view === 'revoked' ? revokedRows : searched;
  const issuedTickets = new Set(issued.filter((row) => !row.revokedAt).map((row) => row.ticketId));
  const pickable = tickets
    .filter((ticket) => !issuedTickets.has(ticket.id))
    .filter((ticket) =>
      pickerMatch(pickQuery, ticketLabel(ticket), ticket.guestEmail ?? undefined),
    );

  const columns: DataListColumn<IssuedCertificate>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Kişi',
      cell: (row) => (
        <DataListTitle
          title={row.recipientName}
          subtitle={<span className={TEXT_SECONDARY}>{row.serial}</span>}
        />
      ),
    },
    {
      id: 'issued',
      width: '11rem',
      from: 'md',
      header: 'Verilme',
      cell: (row) => (
        <span className="text-secondary-foreground text-[13px]/5">{when(row.issuedAt)}</span>
      ),
    },
    {
      id: 'status',
      width: { base: 'auto', sm: '6rem' },
      label: 'Durum',
      cell: (row) => (
        <StatusChip
          kind={row.revokedAt ? 'cancelled' : 'active'}
          label={row.revokedAt ? 'İptal' : 'Geçerli'}
        />
      ),
    },
    {
      id: 'actions',
      width: '2.5rem',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (row) => (
        <RowMenu rowName={row.recipientName}>
          <MenuItem
            icon={ExternalLink}
            onClick={() => window.open(row.verifyUrl, '_blank', 'noopener,noreferrer')}
          >
            Doğrulama sayfası
          </MenuItem>
          {canRevoke && !row.revokedAt ? (
            <MenuItem icon={Ban} destructive disabled={busy} onClick={() => askRevoke(row)}>
              İptal et
            </MenuItem>
          ) : null}
          {canIssue && row.revokedAt ? (
            <MenuItem icon={RefreshCw} disabled={busy} onClick={() => void reissue(row)}>
              Yeniden ver
            </MenuItem>
          ) : null}
        </RowMenu>
      ),
    },
  ];

  const pendingCount = (summary?.queuedCount ?? 0) + (summary?.failedCount ?? 0);
  const ruleText =
    attendanceRule === 'ratio'
      ? `%${Math.round((attendanceRatio ?? 0) * 100)} oturum`
      : attendanceRule === 'once'
        ? 'En az bir oturum'
        : 'Sertifika yok';
  const attendanceText = summary?.attendanceFinalizedAt
    ? `${when(summary.attendanceFinalizedAt)} kapatıldı`
    : !finalizeOpen
      ? 'Etkinlik bitince kapatılır'
      : 'Açık';

  return (
    <div className="space-y-4">
      {confirmDialog}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-skylab-300 text-sm">
          {message}
        </p>
      ) : null}
      {summary ? (
        <>
          <SummaryStrip
            items={[
              { key: 'eligible', label: 'Uygun', value: summary.eligibleCount },
              {
                key: 'issued',
                label: 'Verilen',
                value: summary.issuedCount,
                hint: summary.revokedCount ? (
                  <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                    {summary.revokedCount} iptal
                  </span>
                ) : undefined,
                active: view === 'valid',
                onSelect: canReadIssued
                  ? () => setView(view === 'valid' ? 'all' : 'valid')
                  : undefined,
              },
              {
                key: 'pending',
                label: 'Sırada · Başarısız',
                value: `${summary.queuedCount} · ${summary.failedCount}`,
                hint: summary.failedCount ? (
                  <span className={`text-destructive ${TEXT_SECONDARY}`}>
                    {summary.failedCount} başarısız
                  </span>
                ) : pendingCount ? (
                  <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Üretiliyor</span>
                ) : undefined,
              },
            ]}
          />
          <CommandBar label="Sertifika komutları">
            {canIssue && !summary.attendanceFinalizedAt ? (
              <Command
                primary
                icon={Send}
                label="Katılımı kapat ve üret"
                disabled={busy || attendanceRule === 'none' || !finalizeOpen}
                onClick={() => askFinalize(summary.eligibleCount)}
              />
            ) : null}
            <Command icon={Eye} label="Örnek PDF" onClick={() => void preview()} />
            {canIssue ? (
              <Command
                icon={UserPlus}
                label="Elle ver"
                onClick={() => {
                  setPickQuery('');
                  setPicking(true);
                }}
              />
            ) : null}
            {canBind ? (
              <Command icon={FileBadge} label="Şablonu değiştir" onClick={() => setBinding(true)} />
            ) : null}
          </CommandBar>
          <ObjectEssentials
            title="Kural"
            editHref={ruleHref}
            editName="Kuralı değiştir"
            items={[
              { label: 'Şablon', value: summary.resolution.template.name },
              { label: 'Sürüm', value: `v${summary.resolution.version.version}` },
              { label: 'Kaynak', value: sourceLabel(summary.resolution.source, ownerTeam) },
              { label: 'Katılım kuralı', value: ruleText },
              { label: 'Katılım', value: attendanceText },
            ]}
          />
        </>
      ) : null}

      {canIssue && (failed.length > 0 || failedUnread) ? (
        <ObjectCard title="Başarısız üretim işleri">
          {failedUnread ? (
            <p role="alert" className="text-destructive text-[13px]/5">
              Başarısız üretim işleri okunamadı. Sayfayı yenileyip yeniden dene.
            </p>
          ) : null}
          <ListPanel
            status={listStatus({
              loading: false,
              rowCount: failed.length,
              failed: failedUnread,
              emptyMessage: 'Başarısız iş yok',
            })}
          >
            {failed.map((batch) => (
              <ListItem
                key={batch.id}
                title={`${batchReasonLabel[batch.reason] ?? batch.reason} · ${batch.totalCount} sertifika`}
                subtitle={`${batch.issuedCount} verildi · ${batch.queuedCount} bekliyor · ${batch.failedCount} başarısız · ${when(batch.createdAt)}`}
                trailing={
                  <ActionButton
                    icon={RotateCcw}
                    label="Yeniden dene"
                    showLabel
                    disabled={busy}
                    onClick={() =>
                      confirm({
                        title: `${batch.failedCount} başarısız sertifika yeniden üretilsin mi?`,
                        description: 'Üretilen sertifikalar sahiplerine e-postayla gönderilir.',
                        actionLabel: 'Yeniden dene',
                        destructive: false,
                        onConfirm: async () => {
                          setBusy(true);
                          try {
                            await certificatesApi.retryBatch(batch.id);
                            settled(
                              `${batch.failedCount} başarısız sertifika yeniden kuyruğa alındı.`,
                            );
                            await load();
                          } finally {
                            setBusy(false);
                          }
                        },
                        failure: 'Yeniden denenemedi',
                      })
                    }
                  />
                }
              />
            ))}
          </ListPanel>
        </ObjectCard>
      ) : null}

      {canReadIssued ? (
        <section className="flex flex-col gap-3" aria-label="Verilen sertifikalar">
          <h2 className="text-foreground text-sm font-semibold">Verilen sertifikalar</h2>
          {issued.length ? (
            <ListToolbar
              query={query}
              onQuery={setQuery}
              placeholder="Ad ya da kod"
              searchLabel="Sertifika ara"
              views={[
                { value: 'all', label: 'Hepsi', count: searched.length },
                { value: 'valid', label: 'Geçerli', count: validRows.length },
                { value: 'revoked', label: 'İptal', count: revokedRows.length },
              ]}
              view={view}
              onView={setView}
            />
          ) : null}
          {!issued.length ? (
            <EmptyState kind="first-use" title="Henüz sertifika verilmedi" />
          ) : !shown.length ? (
            <EmptyState
              kind="no-results"
              onClear={() => {
                setQuery('');
                setView('all');
              }}
            />
          ) : (
            <DataList
              columns={columns}
              rows={shown}
              getRowId={(row) => row.id}
              rowLabel={(row) => row.recipientName}
            />
          )}
        </section>
      ) : null}

      <PickerDrawer
        open={picking}
        onClose={() => setPicking(false)}
        title="Elle sertifika ver"
        query={pickQuery}
        onQuery={setPickQuery}
        placeholder="Ad ya da e-posta"
        loading={false}
        options={pickable.map((ticket) => ({
          id: ticket.id,
          title: ticketLabel(ticket),
          subtitle: ticket.guestEmail || undefined,
        }))}
        emptyMessage={pickQuery.trim() ? 'Eşleşen katılımcı yok' : 'Sertifikasız katılımcı yok'}
        onPick={(id) => void issueTo(id)}
      />

      {canBind ? (
        <SidePanel
          open={binding}
          title="Etkinliğe özel şablon"
          onClose={() => {
            setBinding(false);
            setTemplateId(summary?.resolution.template.id ?? '');
          }}
        >
          <fieldset className="space-y-2">
            <legend className="sr-only">Yayınlanmış şablon</legend>
            {availableTemplates.map((template) => (
              <label
                key={template.id}
                className="border-border-subtle has-[:checked]:border-skylab-600/60 flex cursor-pointer items-center gap-3 rounded-md border p-2"
              >
                <input
                  type="radio"
                  name="event-template"
                  checked={templateId === template.id}
                  onChange={() => setTemplateId(template.id)}
                  className="accent-skylab-400"
                />
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm">{template.name}</span>
                  <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                    {template.ownerTeam || 'Kulüp geneli'} · v{template.publishedVersion?.version}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <CommandBar label="Şablon komutları">
            <SaveButton
              type="button"
              disabled={busy || !templateId}
              onClick={async () => {
                setBusy(true);
                try {
                  await certificatesApi.setBinding({
                    scope: 'event',
                    scopeKey: eventId,
                    templateId,
                  });
                  done('Etkinliğe özel şablon seçildi');
                  setBinding(false);
                  await load();
                } catch (cause) {
                  setError(coreProblemMessage(cause, 'Şablon seçilemedi'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Etkinliğe uygula
            </SaveButton>
            {summary?.resolution.source === 'event' ? (
              <Command
                icon={RotateCcw}
                label="Varsayılana dön"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await certificatesApi.clearBinding('event', eventId);
                    done('Etkinliğe özel seçim kaldırıldı; varsayılana dönüldü');
                    setBinding(false);
                    await load();
                  } catch (cause) {
                    setError(coreProblemMessage(cause, 'Seçim kaldırılamadı'));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : null}
          </CommandBar>
        </SidePanel>
      ) : null}
    </div>
  );
}
