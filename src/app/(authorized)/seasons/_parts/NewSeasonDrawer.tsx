'use client';

import { useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { DatePicker } from '@/components/forms/DatePicker';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { coreProblemMessage } from '@/lib/core-problems';
import { toRfc3339 } from '@/lib/datetime-local';
import { useNotify } from '@/lib/ui/use-notify';
import { useDirtySince } from '@/lib/ui/use-unsaved-changes';

const EMPTY = { name: '', active: true, startLocal: '', endLocal: '' };

/** "Sezon ekle": a name, its dates and whether it is the active one; the season's page opens next. */
export function NewSeasonDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (season: Season) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useDirtySince(open, form);
  const notify = useNotify();

  function close() {
    setForm(EMPTY);
    setError(null);
    onClose();
  }

  return (
    <Drawer open={open} onClose={close} title="Sezon ekle" dirty={dirty}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setSaving(true);
          try {
            const season = await seasonsApi.create({
              name: form.name.trim(),
              active: form.active,
              startDate: toRfc3339(form.startLocal),
              endDate: toRfc3339(form.endLocal),
            });
            notify.success('Sezon eklendi');
            setForm(EMPTY);
            onCreated(season);
          } catch (cause) {
            setError(coreProblemMessage(cause, 'Kaydedilemedi'));
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="block space-y-1">
          <FieldLabel>Ad</FieldLabel>
          <Field
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </label>
        <DatePicker
          label="Başlangıç"
          value={form.startLocal}
          onChange={(startLocal) => setForm({ ...form, startLocal })}
        />
        <DatePicker
          label="Bitiş"
          value={form.endLocal}
          onChange={(endLocal) => setForm({ ...form, endLocal })}
        />
        <Switch
          checked={form.active}
          onChange={(active) => setForm({ ...form, active })}
          label="Aktif"
        />
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <SaveButton pending={saving}>Kaydet</SaveButton>
      </form>
    </Drawer>
  );
}
