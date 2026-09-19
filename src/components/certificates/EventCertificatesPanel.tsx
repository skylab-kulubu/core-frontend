'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, Eye, RefreshCw, Send } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import {
  certificatesApi,
  type CertificateEventSummary,
  type CertificateTemplate,
  type IssuedCertificate,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import type { Ticket } from '@/lib/api/tickets';
import { listStatus } from '@/lib/list-status';

const sourceLabel = (source: string | undefined, ownerTeam: string) => {
  if (source === 'event') return 'Etkinliğe özel şablon';
  if (source === 'ownerTeam') {
    const team = ownerTeam === 'YK' || ownerTeam === 'DK' || !ownerTeam ? 'SKY LAB' : ownerTeam;
    return `${team} varsayılanından geliyor`;
  }
  return 'SKY LAB varsayılanından geliyor';
};

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
  eventActive,
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
  eventActive: boolean;
  tickets: Ticket[];
  canIssue: boolean;
  canBind: boolean;
  canRevoke: boolean;
  canReadIssued: boolean;
}) {
  const [summary, setSummary] = useState<CertificateEventSummary>();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

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
      setSummary(nextSummary);
      setTemplates(nextTemplates);
      setIssued(nextIssued);
      setTemplateId(nextSummary.resolution.template.id);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Sertifika bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [canBind, canReadIssued, eventId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 p-5 text-sm text-neutral-500">
        Sertifika alanı yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="text-sm text-red-300">
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
              <div key={label} className="rounded-lg border border-white/10 bg-neutral-950/40 p-3">
                <p className="text-3xs tracking-[.16em] text-neutral-500 uppercase">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-100">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 rounded-xl border border-white/10 bg-neutral-950/40 p-4 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold text-neutral-100">
                {summary.resolution.template.name}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {sourceLabel(summary.resolution.source, ownerTeam)} · v
                {summary.resolution.version.version}
              </p>
              <p className="mt-3 text-xs text-neutral-400">
                Katılım kuralı:{' '}
                {attendanceRule === 'ratio'
                  ? `%${Math.round((attendanceRatio ?? 0) * 100)} oturum`
                  : attendanceRule === 'once'
                    ? 'En az bir oturum'
                    : 'Sertifika yok'}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {summary.attendanceFinalizedAt
                  ? `Katılım ${new Date(summary.attendanceFinalizedAt).toLocaleString('tr-TR')} tarihinde kapatıldı.`
                  : eventActive
                    ? 'Etkinlik aktifken katılım kapatılamaz; otomatik sertifika verilmez.'
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
                    setError(cause instanceof ProblemError ? cause.title : 'Önizleme üretilemedi');
                  }
                }}
              />
              {canIssue && !summary.attendanceFinalizedAt ? (
                <SaveButton
                  type="button"
                  disabled={busy || attendanceRule === 'none' || eventActive}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        'Katılımı kapatıp uygun sertifikaları kuyruğa almak istiyor musun?',
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const batch = await certificatesApi.finalize(eventId);
                      setMessage(`${batch.totalCount} sertifika üretim kuyruğuna alındı.`);
                      await load();
                    } catch (cause) {
                      setError(
                        cause instanceof ProblemError ? cause.title : 'Katılım kapatılamadı',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Katılımı kapat ve üret
                </SaveButton>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {canBind || canIssue ? (
        <div className="grid gap-4 rounded-xl border border-white/10 p-4 lg:grid-cols-2">
          {canBind ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-neutral-200">Etkinliğe özel şablon</p>
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
                      setMessage('Etkinliğe özel şablon seçildi.');
                      await load();
                    } catch (cause) {
                      setError(cause instanceof ProblemError ? cause.title : 'Şablon seçilemedi');
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
                    className="h-8 rounded-md border border-white/10 px-3 text-xs text-neutral-300 hover:bg-white/5"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await certificatesApi.clearBinding('event', eventId);
                        setMessage('Etkinliğe özel seçim kaldırıldı; varsayılana dönüldü.');
                        await load();
                      } catch (cause) {
                        setError(
                          cause instanceof ProblemError ? cause.title : 'Seçim kaldırılamadı',
                        );
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
              <p className="text-sm font-semibold text-neutral-200">Manuel sertifika ver</p>
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
                    setMessage('Manuel sertifika üretim kuyruğuna alındı.');
                    setTicketId('');
                    await load();
                  } catch (cause) {
                    setError(
                      cause instanceof ProblemError ? cause.title : 'Sertifika kuyruğa alınamadı',
                    );
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
          <p className="text-sm font-semibold text-neutral-200">Verilen sertifikalar</p>
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
                        onClick={async () => {
                          await certificatesApi.revoke(certificate.serial);
                          await load();
                        }}
                      />
                    ) : null}
                    {canIssue && certificate.revokedAt ? (
                      <ActionButton
                        icon={RefreshCw}
                        label="Yeniden ver"
                        onClick={async () => {
                          await certificatesApi.reissue(certificate.serial);
                          await load();
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
