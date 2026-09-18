'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { Switch } from '@/components/chrome/Switch';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi, type Season, type SeasonBody } from '@/lib/api/seasons';
import { canWriteSeason } from '@/lib/auth/groups';
import { DatePicker } from '@/components/forms/DatePicker';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 10;

const emptySeason = (): SeasonBody & { startLocal: string; endLocal: string } => ({
  name: '',
  active: true,
  startLocal: '',
  endLocal: '',
});

export default function SeasonsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const canWrite = canWriteSeason(groups);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySeason());
  const [assignEventId, setAssignEventId] = useState('');
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    try {
      setSeasons(await seasonsApi.list());
      setEvents((await eventsApi.list()).map((ev) => ({ id: ev.id, name: ev.name })));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Sezonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(seasons.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return seasons.slice(start, start + PAGE_SIZE);
  }, [seasons, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sezonlar"
        description="Dönemleri yönet, etkinliği bir sezona bağla."
        actions={
          canWrite ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Sezon ekle"
              onClick={() => {
                setEditingId(null);
                setForm(emptySeason());
                setAssignEventId('');
                setOpen(true);
              }}
            />
          ) : undefined
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: seasons.length,
          emptyMessage: 'Sezon yok',
        })}
      >
        {slice.map((season) => (
          <ListItem
            key={season.id}
            title={season.name}
            subtitle={season.active ? 'Aktif' : 'Pasif'}
            trailing={
              canWrite ? (
                <ActionButton
                  icon={Pencil}
                  label="Düzenle"
                  onClick={() => {
                    setEditingId(season.id);
                    setForm({
                      name: season.name,
                      active: season.active,
                      startLocal: toDatetimeLocal(season.startDate),
                      endLocal: toDatetimeLocal(season.endDate),
                    });
                    setAssignEventId('');
                    setOpen(true);
                  }}
                />
              ) : undefined
            }
          />
        ))}
      </ListPanel>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Sezonu düzenle' : 'Sezon ekle'}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const body: SeasonBody = {
                name: form.name.trim(),
                active: form.active,
                startDate: toRfc3339(form.startLocal),
                endDate: toRfc3339(form.endLocal),
              };
              const saved = editingId
                ? await seasonsApi.update(editingId, body)
                : await seasonsApi.create(body);
              if (assignEventId) {
                await seasonsApi.assignEvent(saved.id, assignEventId);
              }
              setOpen(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Kaydedilemedi');
            }
          }}
        >
          <label className="block space-y-1">
            <FieldLabel>Ad</FieldLabel>
            <Field
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Başlangıç</FieldLabel>
            <DatePicker
              value={form.startLocal}
              onChange={(startLocal) => setForm({ ...form, startLocal })}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Bitiş</FieldLabel>
            <DatePicker
              value={form.endLocal}
              onChange={(endLocal) => setForm({ ...form, endLocal })}
            />
          </label>
          <Switch
            checked={form.active}
            onChange={(checked) => setForm({ ...form, active: checked })}
            label="Aktif"
          />
          <label className="block space-y-1">
            <FieldLabel>Etkinlik bağla</FieldLabel>
            <Select value={assignEventId} onChange={(e) => setAssignEventId(e.target.value)}>
              <option value="">Yok</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
          </label>
          {editingId ? (
            <button
              type="button"
              className="h-8 rounded-md border border-red-400/30 px-3 text-xs text-red-300"
              onClick={async () => {
                try {
                  await seasonsApi.delete(editingId);
                  setOpen(false);
                  await load();
                } catch (err) {
                  setError(err instanceof ProblemError ? err.title : 'Silinemedi');
                }
              }}
            >
              Sil
            </button>
          ) : null}
          <SaveButton>Kaydet</SaveButton>
        </form>
      </Drawer>
    </div>
  );
}
