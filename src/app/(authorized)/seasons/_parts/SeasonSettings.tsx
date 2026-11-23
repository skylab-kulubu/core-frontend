'use client';

import { useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { DangerSection, SettingsPage, SettingsSection } from '@/components/chrome/SettingsPage';
import { Switch } from '@/components/chrome/Switch';
import { DatePicker } from '@/components/forms/DatePicker';
import { seasonsApi, type Season, type SeasonBody } from '@/lib/api/seasons';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { UNDO_HINT } from '@/lib/ui/use-confirm';

type Form = { name: string; active: boolean; startLocal: string; endLocal: string };

function formOf(season: Season): Form {
  return {
    name: season.name,
    active: season.active,
    startLocal: toDatetimeLocal(season.startDate),
    endLocal: toDatetimeLocal(season.endDate),
  };
}

/** The season's settings: one Kaydet for its name, dates and state; deleting it last. */
export function SeasonSettings({
  season,
  onSaved,
  onDelete,
}: {
  season: Season;
  onSaved: (season: Season) => void;
  /** Deletes the season (core keeps it to restore); a throw keeps the question open. */
  onDelete: () => Promise<void>;
}) {
  const saved = formOf(season);
  const [form, setForm] = useState<Form>(saved);
  const [saving, setSaving] = useState(false);
  const dirty =
    form.name !== saved.name ||
    form.active !== saved.active ||
    form.startLocal !== saved.startLocal ||
    form.endLocal !== saved.endLocal;

  async function save() {
    setSaving(true);
    try {
      // An emptied date goes as null: core keeps a date left out
      const body: SeasonBody = {
        name: form.name.trim(),
        active: form.active,
        startDate: toRfc3339(form.startLocal) ?? null,
        endDate: toRfc3339(form.endLocal) ?? null,
      };
      const updated = await seasonsApi.update(season.id, body);
      setForm(formOf(updated));
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPage dirty={dirty} saving={saving} onSave={save} onDiscard={() => setForm(saved)}>
      <SettingsSection title="Ad ve durum">
        <label className="block space-y-1">
          <FieldLabel>Ad</FieldLabel>
          <Field
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </label>
        <Switch
          checked={form.active}
          onChange={(active) => setForm({ ...form, active })}
          label="Aktif"
        />
      </SettingsSection>
      <SettingsSection title="Tarihler">
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </SettingsSection>
      <DangerSection
        title="Sezonu sil"
        actionLabel="Sezonu sil"
        confirm={{
          title: `"${season.name}" sezonu silinsin mi?`,
          description: `Sezon listeden kalkar. ${UNDO_HINT}`,
          actionLabel: 'Sezonu sil',
          onConfirm: onDelete,
          failure: 'Sezon silinemedi',
        }}
      />
    </SettingsPage>
  );
}
