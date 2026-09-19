'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, Eye, RefreshCw } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { certificatesApi, type IssuedCertificate } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';
import {
  canIssueCertificates,
  canReadCertificates,
  canRevokeCertificates,
} from '@/lib/auth/groups';

export default function IssuedCertificatesPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [rows, setRows] = useState<IssuedCertificate[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'valid' | 'revoked'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    eventsApi
      .list()
      .then((items) => {
        const allowed = items.filter((event) =>
          canReadCertificates(user?.groups ?? [], user?.roles ?? [], event.ownerTeam),
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
      setRows(await certificatesApi.listIssued(id));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Sertifikalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(eventId);
  }, [eventId]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    return rows.filter((certificate) => {
      const revoked = Boolean(certificate.revokedAt);
      if (status === 'valid' && revoked) return false;
      if (status === 'revoked' && !revoked) return false;
      if (!needle) return true;
      return [certificate.recipientName, certificate.serial, certificate.eventName]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(needle);
    });
  }, [query, rows, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verilen sertifikalar"
        description="Geçerli ve iptal edilmiş kayıtları etkinlik bazında yönet."
      />
      <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
        <label className="space-y-1.5">
          <FieldLabel>Etkinlik</FieldLabel>
          <Select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <FieldLabel>Durum</FieldLabel>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">Tümü</option>
            <option value="valid">Geçerli</option>
            <option value="revoked">İptal</option>
          </Select>
        </label>
        <label className="space-y-1.5">
          <FieldLabel>Ara</FieldLabel>
          <Field
            type="search"
            value={query}
            placeholder="Ad veya sertifika kodu"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
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
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filteredRows.length,
          emptyMessage: 'Verilmiş sertifika yok',
        })}
      >
        {filteredRows.map((certificate) => (
          <ListItem
            key={certificate.id}
            title={certificate.recipientName}
            subtitle={`${certificate.eventName} · ${certificate.serial} · ${new Date(certificate.issuedAt).toLocaleDateString('tr-TR')}`}
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
                {certificate.revokedAt &&
                canIssueCertificates(
                  user?.groups ?? [],
                  user?.roles ?? [],
                  certificate.ownerTeam,
                ) ? (
                  <ActionButton
                    icon={RefreshCw}
                    label="Yeniden ver"
                    onClick={async () => {
                      try {
                        await certificatesApi.reissue(certificate.serial);
                        setMessage('Yeniden üretim kuyruğa alındı.');
                        await load(eventId);
                      } catch (cause) {
                        setError(cause instanceof ProblemError ? cause.title : 'Kuyruğa alınamadı');
                      }
                    }}
                  />
                ) : !certificate.revokedAt &&
                  canRevokeCertificates(
                    user?.groups ?? [],
                    user?.roles ?? [],
                    certificate.ownerTeam,
                  ) ? (
                  <ActionButton
                    icon={Ban}
                    label="İptal et"
                    onClick={async () => {
                      if (!window.confirm('Bu sertifikayı iptal etmek istediğine emin misin?'))
                        return;
                      try {
                        await certificatesApi.revoke(certificate.serial);
                        setMessage('Sertifika iptal edildi.');
                        await load(eventId);
                      } catch (cause) {
                        setError(cause instanceof ProblemError ? cause.title : 'İptal edilemedi');
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
  );
}
