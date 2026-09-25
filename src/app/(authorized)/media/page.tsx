'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2, Upload } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { StatusChip } from '@/components/chrome/StatusChip';
import { Select } from '@/components/chrome/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { mediaApi, type Media } from '@/lib/api/media';
import { eventsApi } from '@/lib/api/events';
import { mediaOwnerTeams, publicMediaUrl } from '@/lib/event-media';
import {
  isPrivateMediaPurpose,
  mediaLifecycleView,
  mediaPurposeLabel,
  orderedMediaPurposes,
} from '@/lib/media-purposes';
import { coreProblemMessage } from '@/lib/core-problems';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { isPrivileged } from '@/lib/auth/groups';
import { useAuth } from '@/context/AuthContext';

/**
 * The Owner teams of the Events that use each Media, archived Events
 * included (the Team media library counts them), or null when the Events
 * cannot be read.
 */
async function ownerTeamsByMediaId(): Promise<Record<string, string[]> | null> {
  try {
    const [current, archived] = await Promise.all([
      eventsApi.list(),
      eventsApi.list(undefined, 'inactive'),
    ]);
    return mediaOwnerTeams([...current, ...archived]);
  } catch {
    return null;
  }
}

function isImage(row: Media) {
  return row.kind?.toLowerCase().includes('image') || row.type?.toLowerCase().startsWith('image/');
}

export default function MediaPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [teamsByMediaId, setTeamsByMediaId] = useState<Record<string, string[]>>({});
  const [teamsFailed, setTeamsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'image' | 'file'>('all');
  const [purpose, setPurpose] = useState('');
  const [team, setTeam] = useState('');
  const [page, setPage] = useState(1);

  async function load() {
    try {
      const [rows, teams] = await Promise.all([mediaApi.list(), ownerTeamsByMediaId()]);
      setItems(rows.filter((row) => !isPrivateMediaPurpose(row.purpose)));
      setTeamsByMediaId(teams ?? {});
      setTeamsFailed(!teams);
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Medya yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (kind === 'image' && !isImage(row)) return false;
      if (kind === 'file' && isImage(row)) return false;
      if (purpose && row.purpose !== purpose) return false;
      if (team && !(teamsByMediaId[row.id] ?? []).includes(team)) return false;
      return matchesQuery(query, row.name, row.kind, row.type);
    });
  }, [items, query, kind, purpose, team, teamsByMediaId]);
  const purposes = useMemo(() => orderedMediaPurposes(items.map((row) => row.purpose)), [items]);
  const ownerTeams = useMemo(
    () =>
      [...new Set(items.flatMap((row) => teamsByMediaId[row.id] ?? []))].sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    [items, teamsByMediaId],
  );
  const paged = paginateRows(filtered, page);

  useEffect(() => {
    setPage(1);
  }, [query, kind, purpose, team]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medya"
        description="Dosya yükle. Duyuru kapağı için adresi kopyalayabilirsin."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setPending(true);
                try {
                  // Without a purpose (legacy): a file uploaded here is copied by its
                  // address into another product, which cannot attach it yet, and a
                  // purposed Media would be purged 24 hours after upload unless attached.
                  await mediaApi.upload(file);
                  await load();
                } catch (err) {
                  setError(coreProblemMessage(err, 'Yüklenemedi'));
                } finally {
                  setPending(false);
                }
              }}
            />
            <ActionButton
              icon={Upload}
              variant="primary"
              label={pending ? 'Yükleniyor…' : 'Yükle'}
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            />
          </>
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {teamsFailed ? (
        <p className="text-sm text-amber-200">
          Sahip ekipler okunamadı; ekip bilgisi ve ekip filtresi eksik.
        </p>
      ) : null}
      <ListToolbar query={query} onQuery={setQuery} placeholder="Dosya adı" searchLabel="Medya ara">
        <FilterPills
          ariaLabel="Medya türü"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'image', label: 'Görsel' },
            { value: 'file', label: 'Dosya' },
          ]}
        />
        <div className="w-44">
          <Select aria-label="Amaç" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="">Tüm amaçlar</option>
            {purposes.map((value) => (
              <option key={value} value={value}>
                {mediaPurposeLabel(value)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Sahip ekip" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Tüm ekipler</option>
            {ownerTeams.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </ListToolbar>
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Henüz dosya yok.',
            noneMatch: 'Eşleşen dosya yok.',
            query,
            filtered: kind !== 'all' || Boolean(purpose) || Boolean(team),
          }),
        })}
        emptyDescription="Yükle veya filtreyi temizle."
      >
        {paged.slice.map((row) => {
          const href = publicMediaUrl(row.url) || row.url;
          const { status, expiry } = mediaLifecycleView(row);
          return (
            <ListItem
              key={row.id}
              title={row.name}
              subtitle={[
                mediaPurposeLabel(row.purpose) || row.kind,
                (teamsByMediaId[row.id] ?? []).join(', '),
                expiry,
                href,
              ]
                .filter(Boolean)
                .join(' · ')}
              leading={
                isImage(row) && href ? (
                  <img
                    src={href}
                    alt=""
                    className="h-9 w-9 rounded-lg border border-white/10 object-cover"
                  />
                ) : undefined
              }
              trailing={
                <div className="flex items-center gap-1">
                  {status ? <StatusChip kind={status.chip} label={status.label} /> : null}
                  <StatusChip
                    kind="neutral"
                    label={isImage(row) ? 'Görsel' : row.kind || 'Dosya'}
                  />
                  {href ? (
                    <ActionButton
                      icon={Copy}
                      label="Adresi kopyala"
                      onClick={() => void navigator.clipboard.writeText(href)}
                    />
                  ) : null}
                  {privileged ? (
                    <ActionButton
                      icon={Trash2}
                      label="Sil"
                      onClick={async () => {
                        try {
                          await mediaApi.remove(row.id);
                          await load();
                        } catch (err) {
                          setError(err instanceof ProblemError ? err.title : 'Silinemedi');
                        }
                      }}
                    />
                  ) : null}
                </div>
              }
            />
          );
        })}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
    </div>
  );
}
