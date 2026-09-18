'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import type { Group } from '@/lib/api/identity';
import {
  GROUP_TEXTS,
  GROUP_TOGGLES,
  buildGroupAttrs,
  extraGroupAttrs,
  isToggleOn,
} from '@/lib/group-attrs';

export function GroupProfile({
  group,
  onSave,
}: {
  group: Group;
  onSave: (next: { name: string; attributes: Record<string, string> }) => Promise<void>;
}) {
  const extra = extraGroupAttrs(group.attributes);
  const [name, setName] = useState(group.name);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setName(group.name);
    const nextToggles: Record<string, boolean> = {};
    for (const row of GROUP_TOGGLES) {
      nextToggles[row.key] = isToggleOn(group.attributes, row.key);
    }
    const nextTexts: Record<string, string> = {};
    for (const row of GROUP_TEXTS) {
      nextTexts[row.key] = group.attributes?.[row.key] ?? '';
    }
    setToggles(nextToggles);
    setTexts(nextTexts);
  }, [group]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setPending(true);
        try {
          await onSave({
            name: name.trim(),
            attributes: buildGroupAttrs({ toggles, texts, extra }),
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="block space-y-1">
        <FieldLabel>Grup adı</FieldLabel>
        <Field value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <div className="space-y-2">
        {GROUP_TOGGLES.map((row) => (
          <Switch
            key={row.key}
            checked={Boolean(toggles[row.key])}
            onChange={(checked) => setToggles((prev) => ({ ...prev, [row.key]: checked }))}
            label={row.label}
            hint={row.hint}
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GROUP_TEXTS.map((row) => (
          <label key={row.key} className="block space-y-1">
            <FieldLabel>{row.label}</FieldLabel>
            {row.multiline ? (
              <TextArea
                rows={3}
                value={texts[row.key] ?? ''}
                onChange={(event) =>
                  setTexts((prev) => ({ ...prev, [row.key]: event.target.value }))
                }
              />
            ) : (
              <Field
                value={texts[row.key] ?? ''}
                onChange={(event) =>
                  setTexts((prev) => ({ ...prev, [row.key]: event.target.value }))
                }
              />
            )}
          </label>
        ))}
      </div>
      <SaveButton disabled={pending}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</SaveButton>
    </form>
  );
}
