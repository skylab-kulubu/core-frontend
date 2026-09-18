'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { ProblemError } from '@/lib/api/core';
import { readFormGate, setFormGate, type FormGate } from '@/lib/api/skyforms';
import { publicShortUrl, urlsApi } from '@/lib/api/urls';
import { editorReturnTo, eventIdForForms } from '@/lib/event-draft';
import {
  APPLY_SLOT_KEY,
  extraFormSlot,
  formsAdminOrigin,
  humanFormAlias,
  skyformsCreateHref,
  skyformsEditHref,
  skyformsFormId,
  shortAliasFromSlug,
  slugYearAlias,
  aliasYear,
  eventFormTitle,
  createAliasWithRetry,
  type EventFormMode,
  type EventFormSlot,
} from '@/lib/event-forms';

type EventFormSlotsProps = {
  slots: EventFormSlot[];
  eventName: string;
  ownerTeam?: string;
  startLocal: string;
  reservedEventId?: string;
  returnTo?: string;
  onLeaveToSkyforms?: () => void;
  onChange: (slots: EventFormSlot[]) => void;
};

export function EventFormSlots({
  slots,
  eventName,
  ownerTeam = '',
  startLocal,
  reservedEventId,
  returnTo,
  onLeaveToSkyforms,
  onChange,
}: EventFormSlotsProps) {
  const [customLabel, setCustomLabel] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gates, setGates] = useState<Record<string, FormGate | 'loading'>>({});
  const year = aliasYear(startLocal);
  const origin = formsAdminOrigin();
  const formIdKey = slots
    .map((slot) => `${slot.key}:${skyformsFormId(slot.url, origin) ?? ''}`)
    .join('|');
  const formIds = useMemo(
    () =>
      formIdKey
        .split('|')
        .map((row) => {
          const [key, id] = row.split(':');
          return { key, id };
        })
        .filter((row) => row.key && row.id),
    [formIdKey],
  );

  useEffect(() => {
    let cancelled = false;
    const ids = formIds;
    if (!ids.length) {
      setGates({});
      return;
    }
    setGates((prev) => {
      const next = { ...prev };
      for (const row of ids) {
        if (!next[row.key]) next[row.key] = 'loading';
      }
      return next;
    });
    void Promise.all(
      ids.map(async (row) => {
        try {
          const gate = await readFormGate(row.id as string);
          return [row.key, gate] as const;
        } catch {
          return [row.key, 'missing'] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setGates(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
  }, [formIds]);

  const bounceFor = (slot: EventFormSlot) => {
    const href = typeof window !== 'undefined' ? window.location.href : returnTo || '';
    const extra = slot.key === APPLY_SLOT_KEY ? '' : slot.label;
    const title = eventFormTitle(ownerTeam, eventName, year, extra);
    const returnHref = href ? editorReturnTo(href, slot.key) : '';
    const formId = skyformsFormId(slot.url, origin);
    if (formId) return skyformsEditHref(origin, formId, returnHref);
    return skyformsCreateHref(origin, returnHref, {
      title,
      ownerTeam,
      eventId: eventIdForForms(href, reservedEventId),
    });
  };

  function patchSlot(key: string, partial: Partial<EventFormSlot>) {
    onChange(slots.map((slot) => (slot.key === key ? { ...slot, ...partial } : slot)));
  }

  function addSlot(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    onChange([...slots, extraFormSlot(trimmed)]);
  }

  async function createShort(slot: EventFormSlot) {
    const url = slot.url.trim();
    if (!url) return;
    const extra = slot.key === APPLY_SLOT_KEY ? '' : slot.label;
    const alias = shortAliasFromSlug(
      slot.alias.trim() ||
        humanFormAlias(ownerTeam, eventName, year, extra) ||
        slugYearAlias(eventName, year, extra),
    );
    setPendingKey(slot.key);
    setError(null);
    try {
      if (slot.urlId) {
        const row = await urlsApi.update(slot.urlId, { url, alias });
        patchSlot(slot.key, { alias: row.alias, urlId: row.id });
      } else {
        const row = await createAliasWithRetry((body) => urlsApi.create(body), url, alias, year);
        patchSlot(slot.key, { alias: row.alias, urlId: row.id });
      }
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Kısa link oluşturulamadı');
      if (!slot.alias.trim()) patchSlot(slot.key, { alias });
    } finally {
      setPendingKey(null);
    }
  }

  async function toggleGate(slot: EventFormSlot, open: boolean) {
    const formId = skyformsFormId(slot.url, origin);
    if (!formId) return;
    setGates((prev) => ({ ...prev, [slot.key]: 'loading' }));
    setError(null);
    try {
      const next = await setFormGate(formId, open);
      setGates((prev) => ({ ...prev, [slot.key]: next }));
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Form durumu güncellenemedi');
      try {
        const current = await readFormGate(formId);
        setGates((prev) => ({ ...prev, [slot.key]: current }));
      } catch {
        setGates((prev) => ({ ...prev, [slot.key]: 'missing' }));
      }
    }
  }

  return (
    <div className="space-y-4">
      {slots.map((slot) => (
        <div key={slot.key} className="space-y-2 rounded-md border border-white/10 bg-white/3 p-3">
          <div className="flex items-center justify-between gap-2">
            {slot.key === APPLY_SLOT_KEY ? (
              <div className="space-y-1">
                <FieldLabel>{slot.label}</FieldLabel>
                <p className="text-2xs text-neutral-500">
                  Giriş yapmış kişiler hesaplarıyla kaydolur. Bu link hesabı olmayanlar veya hesap
                  açmak istemeyenler içindir.
                </p>
              </div>
            ) : (
              <Field
                value={slot.label}
                onChange={(e) => patchSlot(slot.key, { label: e.target.value })}
                placeholder="Form adı"
              />
            )}
            {slot.key !== APPLY_SLOT_KEY ? (
              <ActionButton
                icon={X}
                label="Kaldır"
                onClick={() => onChange(slots.filter((row) => row.key !== slot.key))}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-4">
            <ModeRadio
              name={`form-mode-${slot.key}`}
              value="external"
              checked={slot.mode === 'external'}
              label="Harici URL"
              onPick={() => patchSlot(slot.key, { mode: 'external' })}
            />
            <ModeRadio
              name={`form-mode-${slot.key}`}
              value="skyforms"
              checked={slot.mode === 'skyforms'}
              label="Skyforms’ta oluştur"
              onPick={() => patchSlot(slot.key, { mode: 'skyforms' })}
            />
          </div>
          {slot.mode === 'skyforms' ? (
            <div className="space-y-2">
              {bounceFor(slot) ? (
                <a
                  href={bounceFor(slot) ?? undefined}
                  onClick={() => onLeaveToSkyforms?.()}
                  className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 hover:border-skylab-300/60 hover:bg-skylab-400/20 inline-flex h-8 items-center rounded-md border px-3 font-medium"
                >
                  {skyformsFormId(slot.url, origin)
                    ? 'Daha önceki taslağa git'
                    : 'Skyforms’ta oluştur'}
                </a>
              ) : null}
              {skyformsFormId(slot.url, origin) ? (
                <Switch
                  checked={gates[slot.key] === 'open'}
                  onChange={(open) => void toggleGate(slot, open)}
                  label={gates[slot.key] === 'open' ? 'Form açık' : 'Form kapalı'}
                  hint={
                    gates[slot.key] === 'loading'
                      ? 'Skyforms durumu okunuyor…'
                      : 'Kapalıyken yanıt kabul etmez. Durum Skyforms’taki yayın alanıdır.'
                  }
                />
              ) : null}
              <p className="text-3xs text-neutral-500">
                Skyforms’ta kaydet, sonra etkinliğe dön. Form adresi bu alana yazılır; kısa link
                skyl.app’den basılır. Yeni taslak açık gelir.
              </p>
            </div>
          ) : null}
          <label className="block space-y-1">
            <FieldLabel>Form adresi</FieldLabel>
            <Field
              type="url"
              value={slot.url}
              placeholder={slot.mode === 'skyforms' ? 'Skyforms form URL' : 'https://'}
              onChange={(e) => patchSlot(slot.key, { url: e.target.value })}
              onBlur={() => {
                if (slot.url.trim() && !slot.alias.trim() && !slot.urlId) {
                  void createShort({
                    ...slot,
                    alias: humanFormAlias(
                      ownerTeam,
                      eventName,
                      aliasYear(startLocal),
                      slot.key === APPLY_SLOT_KEY ? '' : slot.label,
                    ),
                  });
                }
              }}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Kısa adres</FieldLabel>
            <Field
              value={slot.alias}
              placeholder={humanFormAlias(
                ownerTeam,
                eventName,
                aliasYear(startLocal),
                slot.key === APPLY_SLOT_KEY ? '' : slot.label,
              )}
              onChange={(e) => patchSlot(slot.key, { alias: e.target.value })}
            />
          </label>
          {slot.alias ? (
            <p className="text-3xs text-neutral-500">
              {publicShortUrl(shortAliasFromSlug(slot.alias))}
            </p>
          ) : null}
          <SaveButton
            type="button"
            disabled={pendingKey === slot.key || !slot.url.trim()}
            onClick={() => void createShort(slot)}
          >
            {pendingKey === slot.key ? 'Oluşturuluyor…' : 'Kısa link oluştur'}
          </SaveButton>
        </div>
      ))}
      <div className="space-y-2">
        <FieldLabel>Form ekle</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <SaveButton type="button" onClick={() => addSlot('Yarışma')}>
            Yarışma
          </SaveButton>
          <SaveButton type="button" onClick={() => addSlot('CTF')}>
            CTF
          </SaveButton>
        </div>
        <div className="flex gap-2">
          <Field
            value={customLabel}
            placeholder="Özel ad"
            onChange={(e) => setCustomLabel(e.target.value)}
          />
          <SaveButton
            type="button"
            disabled={!customLabel.trim()}
            onClick={() => {
              addSlot(customLabel);
              setCustomLabel('');
            }}
          >
            Ekle
          </SaveButton>
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function ModeRadio({
  name,
  value,
  checked,
  label,
  onPick,
}: {
  name: string;
  value: EventFormMode;
  checked: boolean;
  label: string;
  onPick: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-200">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onPick}
        className="accent-skylab-500"
      />
      {label}
    </label>
  );
}
