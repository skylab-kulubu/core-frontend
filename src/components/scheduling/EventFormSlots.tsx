'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { AliasHint } from '@/components/urls/AliasHint';
import { ProblemError } from '@/lib/api/core';
import { readFormGate, setFormGate, type FormGate } from '@/lib/api/skyforms';
import { publicShortUrl, urlsApi } from '@/lib/api/urls';
import { editorReturnTo, eventIdForForms } from '@/lib/event-draft';
import {
  APPLY_SLOT_KEY,
  extraFormSlot,
  formsAdminOrigin,
  defaultSlotAlias,
  keepsSavedLink,
  linkSlot,
  namesSkyformsForm,
  savedAliasIsStale,
  skyformsCreateHref,
  skyformsEditHref,
  skyformsFormId,
  shortAliasFromSlug,
  slotAlias,
  slotExtra,
  aliasYear,
  eventFormTitle,
  type EventFormMode,
  type EventFormSlot,
  type SlotLinkResult,
} from '@/lib/event-forms';
import { useAliasHint } from '@/lib/ui/use-alias-hint';

/** What the slot says after its button when no link was made on the spot. */
const NOTICES: Record<Exclude<SlotLinkResult['status'], 'linked'>, string> = {
  createdOnSave: 'Kısa link etkinlik kaydedilince oluşur',
  appliedOnSave: 'Kısa link etkinlik kaydedilince uygulanır',
  exists: 'Kısa link zaten var',
};

/** What a Skyforms slot's hint checks with core, and the link's own alias it skips. */
type AliasCheck = { alias: string; currentAlias?: string };

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
  const [notice, setNotice] = useState<{ key: string; text: string } | null>(null);
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
    const title = eventFormTitle(ownerTeam, eventName, year, slotExtra(slot));
    const returnHref = href ? editorReturnTo(href, slot.key) : '';
    const formId = skyformsFormId(slot.url, origin);
    if (formId) return skyformsEditHref(origin, formId, returnHref);
    return skyformsCreateHref(origin, returnHref, {
      title,
      ownerTeam,
      eventId: eventIdForForms(href, reservedEventId),
    });
  };

  /** Writes what the slot's button got back; the notice it set stays. */
  function storeSlotResult(key: string, partial: Partial<EventFormSlot>) {
    onChange(slots.map((slot) => (slot.key === key ? { ...slot, ...partial } : slot)));
  }

  /** Writes a change the operator made, which drops the slot's last notice. */
  function editSlotByHand(key: string, partial: Partial<EventFormSlot>) {
    if (notice?.key === key) setNotice(null);
    storeSlotResult(key, partial);
  }

  /**
   * A Skyforms slot's hint checks the alias the slot is saved under (the
   * default when the field is empty), unless that is still its own link.
   */
  function aliasCheck(slot: EventFormSlot): AliasCheck {
    const alias = slotAlias(slot, ownerTeam, eventName, year);
    return { alias, currentAlias: keepsSavedLink(slot, alias) ? slot.saved?.alias : undefined };
  }

  function addSlot(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    onChange([...slots, extraFormSlot(trimmed)]);
  }

  /** Fills the slot's alias and makes its link where the panel owns it (see linkSlot). */
  async function createShort(slot: EventFormSlot) {
    if (!slot.url.trim()) return;
    const alias = slotAlias(slot, ownerTeam, eventName, year);
    setError(null);
    setNotice(null);
    setPendingKey(slot.key);
    try {
      const result = await linkSlot(slot, alias, year, urlsApi);
      if (result.status === 'linked') {
        storeSlotResult(slot.key, { alias: result.alias, urlId: result.urlId });
      } else {
        storeSlotResult(slot.key, { alias: result.alias });
        setNotice({ key: slot.key, text: NOTICES[result.status] });
      }
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Kısa link oluşturulamadı');
      if (!slot.alias.trim()) storeSlotResult(slot.key, { alias });
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
        <div key={slot.key} className="border-border bg-card space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            {slot.key === APPLY_SLOT_KEY ? (
              <div className="space-y-1">
                <FieldLabel>{slot.label}</FieldLabel>
                <p className="text-2xs text-subtle-foreground">
                  Giriş yapmış kişiler hesaplarıyla kaydolur. Bu link hesabı olmayanlar veya hesap
                  açmak istemeyenler içindir.
                </p>
              </div>
            ) : (
              <Field
                value={slot.label}
                onChange={(e) => editSlotByHand(slot.key, { label: e.target.value })}
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
              onPick={() => editSlotByHand(slot.key, { mode: 'external' })}
            />
            <ModeRadio
              name={`form-mode-${slot.key}`}
              value="skyforms"
              checked={slot.mode === 'skyforms'}
              label="Skyforms’ta oluştur"
              onPick={() => editSlotByHand(slot.key, { mode: 'skyforms' })}
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
                  {namesSkyformsForm(slot.url, origin)
                    ? 'Daha önceki taslağa git'
                    : 'Skyforms’ta oluştur'}
                </a>
              ) : null}
              {namesSkyformsForm(slot.url, origin) ? (
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
              <p className="text-3xs text-subtle-foreground">
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
              onChange={(e) => editSlotByHand(slot.key, { url: e.target.value })}
              onBlur={() => {
                const needsAlias = !slot.alias.trim() || savedAliasIsStale(slot);
                if (slot.url.trim() && !slot.urlId && needsAlias) void createShort(slot);
              }}
            />
          </label>
          <SlotAliasField
            value={slot.alias}
            placeholder={defaultSlotAlias(slot, ownerTeam, eventName, year)}
            check={namesSkyformsForm(slot.url, origin) ? aliasCheck(slot) : null}
            onAlias={(alias) => editSlotByHand(slot.key, { alias })}
          />
          {slot.alias ? (
            <p className="text-3xs text-subtle-foreground">
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
          <p role="status" className="text-3xs text-subtle-foreground">
            {notice?.key === slot.key ? notice.text : null}
          </p>
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
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

/**
 * The slot's alias field. With `check` (a Skyforms Form's slot) it shows
 * core's availability answer as a warning only: `taken` may be the Form's own
 * link, which the Event takes over on save, so nothing here blocks the save.
 */
function SlotAliasField({
  value,
  placeholder,
  check,
  onAlias,
}: {
  value: string;
  placeholder: string;
  check: AliasCheck | null;
  onAlias: (alias: string) => void;
}) {
  const hintId = useId();
  const hint = useAliasHint(check?.alias ?? '', 'eventForm', check?.currentAlias);
  return (
    <>
      <label className="block space-y-1">
        <FieldLabel>Kısa adres</FieldLabel>
        <Field
          value={value}
          placeholder={placeholder}
          aria-describedby={check ? hintId : undefined}
          onChange={(e) => onAlias(e.target.value)}
        />
      </label>
      {check ? <AliasHint id={hintId} hint={hint} /> : null}
    </>
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
    <label className="text-secondary-foreground flex items-center gap-2 text-xs">
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
