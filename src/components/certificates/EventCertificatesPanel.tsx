'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, Eye, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
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
  if (source === 'event') return 'Etkinliğe özel şablon';
  if (source === 'ownerTeam') {
    const team = ownerTeam === 'YK' || ownerTeam === 'DK' || !ownerTeam ? 'SKY LAB' : ownerTeam;
    return `${team} varsayılanından geliyor`;
  }
  return 'SKY LAB varsayılanından geliyor';
};

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
}: {
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
  const [ticketId, setTicketId] = useState('');
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

  if (loading) {
    return (
      <div className="border-border text-subtle-foreground rounded-xl border p-5 text-sm">
        Sertifika alanı yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Uygun', summary.eligibleCount],
              ['Verilen', summary.issuedCount],
              ['Kuyrukta', summary.queuedCount],
              ['Başarısız', summary.failedCount],
              ['İptal', summary.revokedCount],
            ].map(([label, value]) => (
              <div key={label} className="border-border bg-sidebar/40 rounded-lg border p-3">
                <p className="text-2xs text-subtle-foreground font-medium">{label}</p>
                <p className="text-foreground mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="border-border bg-sidebar/40 grid gap-4 rounded-xl border p-4 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-foreground text-sm font-semibold">
                {summary.resolution.template.name}
              </p>
              <p className="text-subtle-foreground mt-1 text-xs">
                {sourceLabel(summary.resolution.source, ownerTeam)} · v
                {summary.resolution.version.version}
              </p>
              <p className="text-muted-foreground mt-3 text-xs">
                Katılım kuralı:{' '}
                {attendanceRule === 'ratio'
                  ? `%${Math.round((attendanceRatio ?? 0) * 100)} oturum`
                  : attendanceRule === 'once'
                    ? 'En az bir oturum'
                    : 'Sertifika yok'}
              </p>
              <p className="text-subtle-foreground mt-1 text-xs">
                {summary.attendanceFinalizedAt
                  ? `Katılım ${new Date(summary.attendanceFinalizedAt).toLocaleString('tr-TR')} tarihinde kapatıldı.`
                  : !finalizeOpen
                    ? 'Etkinlik bitmeden katılım kapatılamaz; otomatik sertifika verilmez.'
                    : 'Katılım henüz kapatılmadı; otomatik sertifika verilmez.'}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <ActionButton
                icon={Eye}
                label="Örnek PDF"
                onClick={async () => {
                  try {
                    const blob = await certificatesApi.previewEvent(eventId);
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank', 'noopener,noreferrer');
                    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  } catch (cause) {
                    setError(coreProblemMessage(cause, 'Önizleme üretilemedi'));
                  }
                }}
              />
              {canIssue && !summary.attendanceFinalizedAt ? (
                <SaveButton
                  type="button"
                  disabled={busy || attendanceRule === 'none' || !finalizeOpen}
                  onClick={() =>
                    confirm({
                      title: 'Katılım kapatılıp sertifikalar üretilsin mi?',
                      description: `Katılım kuralına uyan ${summary.eligibleCount} kişiye sertifika üretilir ve e-postayla gönderilir. Geri alınamaz: katılım kapandıktan sonra açılmaz, giden e-posta geri çekilmez.`,
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
                    })
                  }
                >
                  Katılımı kapat ve üret
                </SaveButton>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {canIssue && (failed.length > 0 || failedUnread) ? (
        <div className="space-y-3">
          <p className="text-secondary-foreground text-sm font-semibold">Başarısız üretim işleri</p>
          {failedUnread ? (
            <p role="alert" className="text-destructive text-xs">
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
                subtitle={`${batch.issuedCount} verildi · ${batch.queuedCount} bekliyor · ${batch.failedCount} başarısız · ${new Date(batch.createdAt).toLocaleString('tr-TR')}`}
                trailing={
                  <ActionButton
                    icon={RotateCcw}
                    label="Yeniden dene"
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
        </div>
      ) : null}

      {canBind || canIssue ? (
        <div className="border-border grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
          {canBind ? (
            <div className="space-y-3">
              <p className="text-secondary-foreground text-sm font-semibold">
                Etkinliğe özel şablon
              </p>
              <label className="block space-y-1.5">
                <FieldLabel>Yayınlanmış şablon</FieldLabel>
                <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · v{template.publishedVersion?.version}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex flex-wrap gap-2">
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
                  <button
                    type="button"
                    className="border-border text-secondary-foreground hover:bg-accent h-8 rounded-md border px-3 text-xs"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await certificatesApi.clearBinding('event', eventId);
                        done('Etkinliğe özel seçim kaldırıldı; varsayılana dönüldü');
                        await load();
                      } catch (cause) {
                        setError(coreProblemMessage(cause, 'Seçim kaldırılamadı'));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Özel seçimi kaldır
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {canIssue ? (
            <div className="space-y-3">
              <p className="text-secondary-foreground text-sm font-semibold">
                Manuel sertifika ver
              </p>
              <label className="block space-y-1.5">
                <FieldLabel>Katılımcı</FieldLabel>
                <Select value={ticketId} onChange={(event) => setTicketId(event.target.value)}>
                  <option value="">Katılımcı seç</option>
                  {tickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      {ticketLabel(ticket)}
                    </option>
                  ))}
                </Select>
              </label>
              <SaveButton
                type="button"
                disabled={busy || !ticketId}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await certificatesApi.issue(eventId, ticketId);
                    done('Manuel sertifika üretim kuyruğuna alındı');
                    setTicketId('');
                    await load();
                  } catch (cause) {
                    setError(coreProblemMessage(cause, 'Sertifika kuyruğa alınamadı'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Send className="h-4 w-4" /> Kuyruğa al
              </SaveButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {canReadIssued ? (
        <div className="space-y-3">
          <p className="text-secondary-foreground text-sm font-semibold">Verilen sertifikalar</p>
          <ListPanel
            status={listStatus({
              loading: false,
              failed: Boolean(error),
              rowCount: issued.length,
              emptyMessage: 'Henüz sertifika verilmedi',
            })}
          >
            {issued.map((certificate) => (
              <ListItem
                key={certificate.id}
                title={certificate.recipientName}
                subtitle={`${certificate.serial} · ${new Date(certificate.issuedAt).toLocaleString('tr-TR')}`}
                trailing={
                  <div className="flex items-center gap-1">
                    <StatusChip
                      kind={certificate.revokedAt ? 'passive' : 'active'}
                      label={certificate.revokedAt ? 'İptal' : 'Geçerli'}
                    />
                    <ActionButton
                      icon={Eye}
                      label="Doğrulama sayfasını aç"
                      onClick={() =>
                        window.open(certificate.verifyUrl, '_blank', 'noopener,noreferrer')
                      }
                    />
                    {canRevoke && !certificate.revokedAt ? (
                      <ActionButton
                        icon={Ban}
                        label="İptal et"
                        disabled={busy}
                        onClick={() =>
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
                          })
                        }
                      />
                    ) : null}
                    {canIssue && certificate.revokedAt ? (
                      <ActionButton
                        icon={RefreshCw}
                        label="Yeniden ver"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError(undefined);
                          try {
                            await certificatesApi.reissue(certificate.serial);
                            done(
                              `${certificate.recipientName} sertifikası yeniden üretim kuyruğuna alındı`,
                            );
                            await load();
                          } catch (cause) {
                            setError(coreProblemMessage(cause, 'Sertifika yeniden verilemedi'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    ) : null}
                  </div>
                }
              />
            ))}
          </ListPanel>
        </div>
      ) : null}
    </div>
  );
}
