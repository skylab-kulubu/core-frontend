'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ProblemError } from '@/lib/api/core';
import { publicShortUrl, urlsApi } from '@/lib/api/urls';
import {
  APPLY_SLOT_KEY,
  extraFormSlot,
  formsAdminOrigin,
  humanFormAlias,
  skyformsCreateHref,
  shortAliasFromSlug,
  slugYearAlias,
  aliasYear,
  type EventFormMode,
  type EventFormSlot,
} from '@/lib/event-forms';

type EventFormSlotsProps = {
  slots: EventFormSlot[];
  eventName: string;
  ownerTeam?: string;
  startLocal: string;
  returnTo?: string;
  onChange: (slots: EventFormSlot[]) => void;
};

export function EventFormSlots({
  slots,
  eventName,
  ownerTeam = '',
  startLocal,
  returnTo,
  onChange,
}: EventFormSlotsProps) {
  const [customLabel, setCustomLabel] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bounce = useMemo(() => {
    const href = typeof window !== 'undefined' ? returnTo || window.location.href : returnTo || '';
    return skyformsCreateHref(formsAdminOrigin(), href);
  }, [returnTo]);

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
        humanFormAlias(ownerTeam, eventName, aliasYear(startLocal), extra) ||
        slugYearAlias(eventName, aliasYear(startLocal), extra),
    );
    setPendingKey(slot.key);
    setError(null);
    try {
      if (slot.urlId) {
        const row = await urlsApi.update(slot.urlId, { url, alias });
        patchSlot(slot.key, { alias: row.alias, urlId: row.id });
      } else {
        const row = await urlsApi.create({ url, alias });
        patchSlot(slot.key, { alias: row.alias, urlId: row.id });
      }
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Kısa link oluşturulamadı');
      if (!slot.alias.trim()) patchSlot(slot.key, { alias });
    } finally {
      setPendingKey(null);
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
            bounce ? (
              <a
                href={bounce}
                target="_blank"
                rel="noreferrer"
                className="text-2xs text-skylab-300 inline-flex h-8 items-center"
              >
                Skyforms taslağı aç
              </a>
            ) : (
              <p className="text-3xs text-neutral-500">
                Skyforms adresi yok. NEXT_PUBLIC_FORMS_ADMIN_URL tanımlandıktan sonra taslak açılır.
              </p>
            )
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
