'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { Select } from '@/components/chrome/Select';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import type { EventBody } from '@/lib/api/events';
import { identityApi, type Person } from '@/lib/api/identity';
import { mediaApi, type Media } from '@/lib/api/media';
import type { Season } from '@/lib/api/seasons';
import { listStatus } from '@/lib/list-status';
import { pickerMatch } from '@/lib/picker';

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
    attendanceRule: 'none',
    attendanceRatio: undefined,
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
  const [people, setPeople] = useState<Person[]>([]);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  useEffect(() => {
    mediaApi
      .list()
      .then((rows) => setMedia(rows.filter((row) => row.kind === 'IMAGE')))
      .catch(() => setMedia([]));
  }, []);

  useEffect(() => {
    if (!assignDoorStaff) return;
    identityApi
      .listUsers()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [assignDoorStaff]);

  useEffect(() => {
    if (!staffOpen) return;
    const handle = window.setTimeout(
      () => {
        setStaffLoading(true);
        identityApi
          .listUsers(staffQuery)
          .then(setPeople)
          .catch(() => setPeople([]))
          .finally(() => setStaffLoading(false));
      },
      staffQuery.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(handle);
  }, [staffOpen, staffQuery]);

  const staffIds = value.doorStaffIds ?? [];
  const staffById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <FieldLabel>Ad</FieldLabel>
        <Field
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          required
          placeholder="Etkinlik adı"
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Konum</FieldLabel>
        <Field
          value={value.location}
          onChange={(e) => patch({ location: e.target.value })}
          required
          placeholder="YTÜ Davutpaşa"
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Sahip ekip</FieldLabel>
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
        <FieldLabel>Açıklama</FieldLabel>
        <TextArea
          rows={4}
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <FieldLabel>Başlangıç</FieldLabel>
          <Field
            type="datetime-local"
            value={value.startDate ?? ''}
            onChange={(e) => patch({ startDate: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <FieldLabel>Bitiş</FieldLabel>
          <Field
            type="datetime-local"
            value={value.endDate ?? ''}
            onChange={(e) => patch({ endDate: e.target.value })}
          />
        </label>
      </div>
      <label className="block space-y-1">
        <FieldLabel>Kapasite</FieldLabel>
        <Field
          type="number"
          min={0}
          value={Number.isFinite(value.capacity) ? value.capacity : 0}
          onChange={(e) => patch({ capacity: Number(e.target.value) || 0 })}
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Kapak görseli</FieldLabel>
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
        <FieldLabel>Galeri görselleri</FieldLabel>
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
        <FieldLabel>Form URL</FieldLabel>
        <Field
          type="url"
          value={value.formUrl ?? ''}
          onChange={(e) => patch({ formUrl: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>LinkedIn</FieldLabel>
        <Field
          type="url"
          value={value.linkedin ?? ''}
          onChange={(e) => patch({ linkedin: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Ödül</FieldLabel>
        <Field
          value={value.prizeInfo ?? ''}
          onChange={(e) => patch({ prizeInfo: e.target.value })}
        />
      </label>
      {showSeason ? (
        <label className="block space-y-1">
          <FieldLabel>Sezon</FieldLabel>
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
      <Switch
        checked={value.active}
        onChange={(checked) => patch({ active: checked })}
        label="Aktif"
      />
      <Switch
        checked={value.ranked}
        onChange={(checked) => patch({ ranked: checked })}
        label="Sıralamalı"
      />
      <label className="block space-y-1">
        <FieldLabel>Sertifika kuralı</FieldLabel>
        <Select
          value={value.attendanceRule ?? 'none'}
          onChange={(e) =>
            patch({
              attendanceRule: e.target.value,
              attendanceRatio:
                e.target.value === 'ratio' ? (value.attendanceRatio ?? 0.75) : undefined,
            })
          }
        >
          <option value="none">Yok</option>
          <option value="once">En az bir oturum</option>
          <option value="ratio">Oran</option>
        </Select>
      </label>
      {value.attendanceRule === 'ratio' ? (
        <label className="block space-y-1">
          <FieldLabel>Katılım oranı</FieldLabel>
          <Field
            type="number"
            min={0.01}
            max={1}
            step={0.01}
            value={value.attendanceRatio ?? 0.75}
            onChange={(e) => patch({ attendanceRatio: Number(e.target.value) })}
          />
        </label>
      ) : null}
      {assignDoorStaff ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Kapı görevlileri</FieldLabel>
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Kişi ekle"
              onClick={() => {
                setStaffQuery('');
                setStaffOpen(true);
              }}
            />
          </div>
          <ListPanel
            status={listStatus({
              loading: false,
              rowCount: staffIds.length,
              emptyMessage: 'Atanmış kişi yok',
            })}
          >
            {staffIds.map((id) => {
              const person = staffById.get(id);
              const name = person
                ? `${person.firstName} ${person.lastName}`.trim() || person.email
                : id;
              return (
                <ListItem
                  key={id}
                  title={name}
                  subtitle={person?.email ?? id}
                  trailing={
                    <ActionButton
                      icon={X}
                      label="Kaldır"
                      onClick={() =>
                        patch({ doorStaffIds: staffIds.filter((row) => row !== id) })
                      }
                    />
                  }
                />
              );
            })}
          </ListPanel>
          <PickerDrawer
            open={staffOpen}
            onClose={() => setStaffOpen(false)}
            title="Kapı görevlisi ekle"
            query={staffQuery}
            onQuery={setStaffQuery}
            placeholder="Ad, e-posta"
            loading={staffLoading}
            options={people
              .filter(
                (person) =>
                  !staffIds.includes(person.id) &&
                  pickerMatch(
                    staffQuery,
                    person.email,
                    person.firstName,
                    person.lastName,
                  ),
              )
              .map((person) => ({
                id: person.id,
                title: `${person.firstName} ${person.lastName}`.trim() || person.email,
                subtitle: person.email,
              }))}
            emptyMessage="Kullanıcı yok"
            onPick={(picked) => {
              patch({ doorStaffIds: [...staffIds, picked] });
              setStaffOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
