'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { certificatesApi, type CertificateBatch } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';
import { canIssueCertificates } from '@/lib/auth/groups';

const statusKind = (status: CertificateBatch['status']) => {
  if (status === 'completed') return 'active' as const;
  if (status === 'failed' || status === 'partial') return 'passive' as const;
  return 'pending' as const;
};

export default function CertificateJobsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [rows, setRows] = useState<CertificateBatch[]>([]);
  const [selected, setSelected] = useState<CertificateBatch>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    eventsApi
      .list()
      .then((items) => {
        const allowed = items.filter((event) =>
          canIssueCertificates(user?.groups ?? [], user?.roles ?? [], event.ownerTeam),
        );
        setEvents(allowed);
        setEventId(allowed[0]?.id ?? '');
      })
      .catch((cause) =>
        setError(cause instanceof ProblemError ? cause.title : 'Etkinlikler yüklenemedi'),
      )
      .finally(() => setLoading(false));
  }, [user]);

  async function load(id: string) {
    if (!id) return setRows([]);
    setLoading(true);
    try {
      setRows(await certificatesApi.listBatches(id));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Üretim işleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(eventId);
  }, [eventId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifika üretim işleri"
        description="Kuyruk, deneme ve hata durumlarını tek yerden izle."
      />
      <label className="block max-w-md space-y-1.5">
        <FieldLabel>Etkinlik</FieldLabel>
        <Select value={eventId} onChange={(event) => setEventId(event.target.value)}>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </Select>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: rows.length,
          emptyMessage: 'Üretim işi yok',
        })}
      >
        {rows.map((batch) => (
          <ListItem
            key={batch.id}
            onSelect={async () => {
              setDetailLoading(true);
              try {
                setSelected(await certificatesApi.batch(batch.id));
              } catch (cause) {
                setError(cause instanceof ProblemError ? cause.title : 'İş ayrıntısı yüklenemedi');
              } finally {
                setDetailLoading(false);
              }
            }}
            title={`${batch.reason === 'finalization' ? 'Katılım kapatma' : batch.reason === 'manual' ? 'Manuel verme' : 'Yeniden verme'} · ${batch.totalCount} sertifika`}
            subtitle={`${batch.issuedCount} verildi · ${batch.queuedCount} bekliyor · ${batch.failedCount} başarısız · ${new Date(batch.createdAt).toLocaleString('tr-TR')}`}
            trailing={
              <div className="flex items-center gap-1">
                <StatusChip kind={statusKind(batch.status)} label={batch.status} />
                {batch.failedCount > 0 ? (
                  <ActionButton
                    icon={RefreshCw}
                    label="Başarısızları yeniden dene"
                    onClick={async () => {
                      try {
                        await certificatesApi.retryBatch(batch.id);
                        await load(eventId);
                      } catch (cause) {
                        setError(
                          cause instanceof ProblemError ? cause.title : 'Tekrar başlatılamadı',
                        );
                      }
                    }}
                  />
                ) : null}
              </div>
            }
          />
        ))}
      </ListPanel>
      {detailLoading ? <StateCard title="İş ayrıntısı yükleniyor…" isLoading /> : null}
      {selected && !detailLoading ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">İş ayrıntısı</h2>
              <p className="text-3xs mt-1 font-mono text-neutral-500">{selected.id}</p>
            </div>
            <button
              type="button"
              className="h-8 rounded-md border border-white/10 px-3 text-xs text-neutral-400 hover:bg-white/5"
              onClick={() => setSelected(undefined)}
            >
              Kapat
            </button>
          </div>
          <ListPanel
            status={listStatus({
              loading: false,
              failed: false,
              rowCount: selected.jobs?.length ?? 0,
              emptyMessage: 'Bu işte alıcı yok',
            })}
          >
            {(selected.jobs ?? []).map((job) => (
              <ListItem
                key={job.id}
                title={`Bilet ${job.ticketId}`}
                subtitle={`Deneme ${job.attemptCount}${job.errorCode ? ` · ${job.errorCode}` : ''}`}
                trailing={
                  <StatusChip
                    kind={
                      job.status === 'issued'
                        ? 'active'
                        : job.status === 'failed'
                          ? 'passive'
                          : 'pending'
                    }
                    label={job.status}
                  />
                }
              />
            ))}
          </ListPanel>
        </section>
      ) : null}
    </div>
  );
}
