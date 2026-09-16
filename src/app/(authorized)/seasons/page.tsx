'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi, type Season, type SeasonBody } from '@/lib/api/seasons';
import { canWriteSeason } from '@/lib/auth/groups';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { saveClass } from '@/lib/scheduling/save-event';
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
        description="Yazma yetkisi Privileged."
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
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
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
      </div>
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
          <Field
            placeholder="Ad"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Field
            type="datetime-local"
            value={form.startLocal}
            onChange={(e) => setForm({ ...form, startLocal: e.target.value })}
          />
          <Field
            type="datetime-local"
            value={form.endLocal}
            onChange={(e) => setForm({ ...form, endLocal: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Aktif
          </label>
          <Field
            placeholder="Etkinlik id (sezona bağla)"
            value={assignEventId}
            onChange={(e) => setAssignEventId(e.target.value)}
            list="season-events"
          />
          <datalist id="season-events">
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </datalist>
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
          <button type="submit" className={saveClass}>
            Kaydet
          </button>
        </form>
      </Drawer>
    </div>
  );
}
