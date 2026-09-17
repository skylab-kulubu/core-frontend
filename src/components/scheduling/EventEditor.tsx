'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { Select } from '@/components/chrome/Select';
import { TextArea } from '@/components/chrome/TextArea';
import type { EventBody } from '@/lib/api/events';
import { mediaApi, type Media } from '@/lib/api/media';
import type { Season } from '@/lib/api/seasons';

export type EventFormState = EventBody & { seasonId: string; imageIds: string[] };

type EventEditorProps = {
  value: EventFormState;
  onChange: (next: EventFormState) => void;
  ownerOptions: string[];
  lockOwner?: boolean;
  seasons?: Season[];
  showSeason?: boolean;
  ownerOptional?: boolean;
  assignDoorStaff?: boolean;
};

const inputLabel = 'text-3xs tracking-[0.14em] text-neutral-500 uppercase';

export function emptyEventForm(ownerTeam = ''): EventFormState {
  return {
    name: '',
    description: '',
    location: '',
    ownerTeam,
    formUrl: '',
    capacity: 0,
    startDate: '',
    endDate: '',
    linkedin: '',
    active: true,
    ranked: false,
    prizeInfo: '',
    seasonId: '',
    coverImageId: '',
    imageIds: [],
    doorStaffIds: [],
  };
}

export function parseDoorStaffIds(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function EventEditor({
  value,
  onChange,
  ownerOptions,
  lockOwner,
  seasons = [],
  showSeason,
  ownerOptional,
  assignDoorStaff,
}: EventEditorProps) {
  const patch = (partial: Partial<EventFormState>) => onChange({ ...value, ...partial });
  const [media, setMedia] = useState<Media[]>([]);

  useEffect(() => {
    mediaApi
      .list()
      .then((rows) => setMedia(rows.filter((row) => row.kind === 'IMAGE')))
      .catch(() => setMedia([]));
  }, []);

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className={inputLabel}>Ad</span>
        <Field
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          required
          placeholder="Etkinlik adı"
        />
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Konum</span>
        <Field
          value={value.location}
          onChange={(e) => patch({ location: e.target.value })}
          required
          placeholder="YTÜ Davutpaşa"
        />
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Sahip ekip</span>
        {ownerOptions.length > 0 ? (
          <Select
            value={value.ownerTeam}
            disabled={lockOwner}
            onChange={(e) => patch({ ownerTeam: e.target.value })}
            required={!ownerOptional}
          >
            <option value="">{ownerOptional ? 'Yok' : 'Seçiniz'}</option>
            {ownerOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </Select>
        ) : (
          <Field
            value={value.ownerTeam}
            onChange={(e) => patch({ ownerTeam: e.target.value })}
            required={!ownerOptional}
            placeholder="WEBLAB"
            disabled={lockOwner}
          />
        )}
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Açıklama</span>
        <TextArea
          rows={4}
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className={inputLabel}>Başlangıç</span>
          <Field
            type="datetime-local"
            value={value.startDate ?? ''}
            onChange={(e) => patch({ startDate: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className={inputLabel}>Bitiş</span>
          <Field
            type="datetime-local"
            value={value.endDate ?? ''}
            onChange={(e) => patch({ endDate: e.target.value })}
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className={inputLabel}>Kapasite</span>
        <Field
          type="number"
          min={0}
          value={Number.isFinite(value.capacity) ? value.capacity : 0}
          onChange={(e) => patch({ capacity: Number(e.target.value) || 0 })}
        />
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Kapak görseli</span>
        <Select
          value={value.coverImageId ?? ''}
          onChange={(e) => patch({ coverImageId: e.target.value })}
        >
          <option value="">Yok</option>
          {media.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Galeri görselleri</span>
        <Select
          multiple
          className="h-24"
          value={value.imageIds ?? []}
          onChange={(e) =>
            patch({
              imageIds: Array.from(e.target.selectedOptions).map((option) => option.value),
            })
          }
        >
          {media.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Form URL</span>
        <Field
          type="url"
          value={value.formUrl ?? ''}
          onChange={(e) => patch({ formUrl: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>LinkedIn</span>
        <Field
          type="url"
          value={value.linkedin ?? ''}
          onChange={(e) => patch({ linkedin: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className={inputLabel}>Ödül</span>
        <Field
          value={value.prizeInfo ?? ''}
          onChange={(e) => patch({ prizeInfo: e.target.value })}
        />
      </label>
      {showSeason ? (
        <label className="block space-y-1">
          <span className={inputLabel}>Sezon</span>
          <Select value={value.seasonId} onChange={(e) => patch({ seasonId: e.target.value })}>
            <option value="">Yok</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        Aktif
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={value.ranked}
          onChange={(e) => patch({ ranked: e.target.checked })}
        />
        Sıralamalı
      </label>
      {assignDoorStaff ? (
        <label className="block space-y-1">
          <span className={inputLabel}>Kapı görevlisi user id</span>
          <TextArea
            rows={3}
            value={(value.doorStaffIds ?? []).join('\n')}
            onChange={(e) => patch({ doorStaffIds: parseDoorStaffIds(e.target.value) })}
            placeholder="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
          />
        </label>
      ) : null}
    </div>
  );
}
