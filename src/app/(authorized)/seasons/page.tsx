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
import { StatusChip } from '@/components/chrome/StatusChip';
import { Switch } from '@/components/chrome/Switch';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi, type Season, type SeasonBody } from '@/lib/api/seasons';
import { canWriteSeason } from '@/lib/auth/groups';
import { DatePicker } from '@/components/forms/DatePicker';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { formatEventWhen } from '@/lib/events-view';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { activeStatus } from '@/lib/status-chip';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import { useAuth } from '@/context/AuthContext';

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
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'passive'>('all');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySeason());
  const [assignEventId, setAssignEventId] = useState('');
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  async function load() {
    try {
      setSeasons(await seasonsApi.list());
      setEvents((await eventsApi.list()).map((ev) => ({ id: ev.id, name: ev.name })));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Sezonlar yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return seasons.filter((season) => {
      if (activeOnly === 'active' && !season.active) return false;
      if (activeOnly === 'passive' && season.active) return false;
      return matchesQuery(query, season.name);
    });
  }, [seasons, query, activeOnly]);
  const paged = paginateRows(filtered, page);

  useEffect(() => {
    setPage(1);
  }, [query, activeOnly]);

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
                setFormError(null);
                setOpen(true);
              }}
            />
          ) : undefined
        }
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ListToolbar query={query} onQuery={setQuery} placeholder="Sezon adı" searchLabel="Sezon ara">
        <FilterPills
          ariaLabel="Sezon durumu"
          value={activeOnly}
          onChange={setActiveOnly}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'active', label: 'Aktif' },
            { value: 'passive', label: 'Pasif' },
          ]}
        />
      </ListToolbar>
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Sezon yok',
            noneMatch: 'Eşleşen sezon yok',
            query,
            filtered: activeOnly !== 'all',
          }),
        })}
        emptyDescription="Dönem ekle veya filtreyi temizle."
      >
        {paged.slice.map((season) => (
          <ListItem
            key={season.id}
            title={season.name}
            subtitle={formatEventWhen({
              id: season.id,
              name: season.name,
              startDate: season.startDate,
              endDate: season.endDate,
            })}
            trailing={
              <div className="flex items-center gap-1">
                <StatusChip kind={activeStatus(season.active)} />
                {canWrite ? (
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
                      setFormError(null);
                      setOpen(true);
                    }}
                  />
                ) : null}
              </div>
            }
          />
        ))}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Sezonu düzenle' : 'Sezon ekle'}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setFormError(null);
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
              notify.success(editingId ? 'Sezon kaydedildi' : 'Sezon eklendi');
              await load();
            } catch (err) {
              setFormError(coreProblemMessage(err, 'Kaydedilemedi'));
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
              className="border-destructive/30 text-destructive h-8 rounded-md border px-3 text-xs"
              onClick={() => {
                const id = editingId;
                const name = seasons.find((season) => season.id === id)?.name ?? form.name;
                confirm({
                  title: `"${name}" sezonu silinsin mi?`,
                  description: `Sezon listeden kalkar. ${UNDO_HINT}`,
                  actionLabel: 'Sezonu sil',
                  onConfirm: async () => {
                    setFormError(null);
                    try {
                      await seasonsApi.delete(id);
                      setOpen(false);
                      notify.undoable(
                        'Sezon silindi',
                        async () => {
                          await seasonsApi.restore(id);
                          void load();
                        },
                        'Sezon geri alındı',
                      );
                      await load();
                    } catch (err) {
                      setFormError(coreProblemMessage(err, 'Silinemedi'));
                    }
                  },
                });
              }}
            >
              Sil
            </button>
          ) : null}
          {formError ? (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          ) : null}
          {confirmDialog}
          <SaveButton>Kaydet</SaveButton>
        </form>
      </Drawer>
    </div>
  );
}
