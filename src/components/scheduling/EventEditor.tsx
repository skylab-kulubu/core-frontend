'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Section } from '@skylab-kulubu/skylcn-ui';
import { ArrowRight, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { Select } from '@/components/chrome/Select';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import { DatePicker } from '@/components/forms/DatePicker';
import { PERSON_SEARCH_HINT, usePersonSearch } from '@/components/identity/use-person-search';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type EventBody, type FeedbackMode } from '@/lib/api/events';
import type { Person } from '@/lib/api/identity';
import type { Season } from '@/lib/api/seasons';
import {
  emptyApplySlot,
  emptyFeedbackSlot,
  persistableFormFields,
  type EventFormSlot,
} from '@/lib/event-forms';
import type { FormInUse } from '@/lib/core-problems';
import type { EventMediaHint } from '@/lib/event-media';
import { listStatus } from '@/lib/list-status';
import { lookupPeople } from '@/lib/people-lookup';
import { pickerMatch } from '@/lib/picker';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { EventFormSlots } from './EventFormSlots';
import { EventLocationFields } from './EventLocationFields';
import { EventMediaFields } from './EventMediaFields';

export type EventFormState = EventBody & {
  seasonId: string;
  imageIds: string[];
  formSlots: EventFormSlot[];
  /** The feedback form, saved as `feedbackFormUrl`/`feedbackFormAlias`. */
  feedbackSlot: EventFormSlot;
  reservedId?: string;
};

/** Where the feedback questions are (SPEC §2.1); "Oturum başına form" puts a form on each Session in Program. */
export const FEEDBACK_MODES: { value: FeedbackMode; label: string }[] = [
  { value: 'event', label: 'Etkinlik formu' },
  { value: 'per_session', label: 'Oturum başına form' },
  { value: 'event_with_sessions', label: 'Etkinlik formunda oturumlar' },
];

type EventEditorProps = {
  value: EventFormState;
  onChange: (next: EventFormState) => void;
  ownerOptions: string[];
  lockOwner?: boolean;
  seasons?: Season[];
  showSeason?: boolean;
  ownerOptional?: boolean;
  assignDoorStaff?: boolean;
  knownMedia?: EventMediaHint[];
  returnTo?: string;
  onLeaveToSkyforms?: () => void;
  /** The form the last save was refused for (`409 form_in_use`). */
  formInUse?: FormInUse | null;
  /** Said at the top of a section, such as choices that could not be loaded. */
  notices?: Partial<Record<EventEditorSectionId, ReactNode>>;
  /** The Sertifikalar tab, where the threshold and the counted Sessions are chosen. */
  certificatesHref?: string;
  /** An older core without the rule editor (no "Oturum sayısı"): the ratio is typed here. */
  legacyRules?: boolean;
  /** The ratio the Event was saved with, if any: kept as it is, a new one is refused. */
  storedRatio?: number;
};

/** The editor's sections in page order, for the jump list beside the form. */
export const EVENT_EDITOR_SECTIONS = [
  { id: 'temel', title: 'Temel bilgiler' },
  { id: 'zaman', title: 'Zaman ve yer' },
  { id: 'basvuru', title: 'Başvuru ve form' },
  { id: 'bilet', title: 'Bilet ve kapı' },
  { id: 'sertifika', title: 'Sertifika' },
  { id: 'yayin', title: 'Görünürlük ve yayın' },
] as const;

export type EventEditorSectionId = (typeof EVENT_EDITOR_SECTIONS)[number]['id'];

/** The section a form problem (eventFormIssue) belongs to, to jump there. */
export function sectionOfIssue(issue: string): EventEditorSectionId {
  if (/adı/i.test(issue)) return 'temel';
  return 'zaman';
}

function EditorSection({
  id,
  title,
  children,
}: {
  id: EventEditorSectionId;
  title: string;
  children: ReactNode;
}) {
  return (
    <Section id={id} title={title} level={2} className="scroll-mt-28 md:scroll-mt-16">
      <div className="space-y-4 pt-3">{children}</div>
    </Section>
  );
}

export function emptyEventForm(ownerTeam = ''): EventFormState {
  return {
    name: '',
    description: '',
    location: '',
    locationAddress: '',
    ownerTeam,
    formUrl: '',
    formAlias: '',
    extraFormUrls: [],
    formSlots: [emptyApplySlot()],
    feedbackMode: 'event',
    feedbackAutoSend: true,
    feedbackSlot: emptyFeedbackSlot(),
    capacity: 0,
    startDate: '',
    endDate: '',
    linkedin: '',
    ranked: false,
    prizeInfo: '',
    seasonId: '',
    coverImageId: '',
    imageIds: [],
    attendanceRule: 'none',
    attendanceRatio: undefined,
    attendanceMinCount: null,
    doorStaffIds: [],
    registrationClosesAt: '',
  };
}

/**
 * The feedback form was closed in Skyforms: core cancels its reminders still
 * to go for good. An Event not created yet (its reserved id), or a core
 * without the call, answers 404: it has none to cancel.
 */
export async function closeFeedbackReminders(eventId: string | undefined, gate: string) {
  if (gate !== 'closed' || !eventId) return;
  try {
    await eventsApi.closeFeedback(eventId);
  } catch (err) {
    if (err instanceof ProblemError && err.status === 404) return;
    throw err;
  }
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
  knownMedia = [],
  returnTo,
  onLeaveToSkyforms,
  formInUse,
  notices = {},
  certificatesHref,
  legacyRules,
  storedRatio,
}: EventEditorProps) {
  const patch = (partial: Partial<EventFormState>) => onChange({ ...value, ...partial });
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState('');
  const [staffPeople, setStaffPeople] = useState<ReadonlyMap<string, Person>>(new Map());
  const staffSearch = usePersonSearch(staffOpen, staffQuery);

  const staffIds = value.doorStaffIds ?? [];
  const staffKey = staffIds.join(',');

  useEffect(() => {
    if (!assignDoorStaff || !staffKey) return;
    let cancelled = false;
    void lookupPeople(staffKey.split(','), staffPeople).then((next) => {
      if (!cancelled && next.size !== staffPeople.size) setStaffPeople(next);
    });
    return () => {
      cancelled = true;
    };
  }, [assignDoorStaff, staffKey]);

  return (
    <div className="space-y-10">
      <EditorSection id="temel" title="Temel bilgiler">
        {notices.temel}
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
        <EventMediaFields
          ownerTeam={value.ownerTeam}
          coverImageId={value.coverImageId ?? ''}
          imageIds={value.imageIds ?? []}
          knownMedia={knownMedia}
          onCover={(id) => patch({ coverImageId: id })}
          onGallery={(ids) => patch({ imageIds: ids })}
        />
      </EditorSection>
      <EditorSection id="zaman" title="Zaman ve yer">
        {notices.zaman}
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker
            label="Başlangıç"
            value={value.startDate ?? ''}
            onChange={(startDate) => patch({ startDate })}
          />
          <DatePicker
            label="Bitiş"
            value={value.endDate ?? ''}
            onChange={(endDate) => patch({ endDate })}
          />
        </div>
        <EventLocationFields value={value} ownerTeam={value.ownerTeam} onChange={patch} />
      </EditorSection>
      <EditorSection id="basvuru" title="Başvuru ve form">
        {notices.basvuru}
        <EventFormSlots
          slots={value.formSlots?.length ? value.formSlots : [emptyApplySlot()]}
          eventName={value.name}
          ownerTeam={value.ownerTeam}
          startLocal={value.startDate ?? ''}
          reservedEventId={value.reservedId}
          returnTo={returnTo}
          onLeaveToSkyforms={onLeaveToSkyforms}
          inUse={formInUse}
          onChange={(formSlots) => patch({ formSlots, ...persistableFormFields(formSlots) })}
        />
        <div className="space-y-2">
          <label className="block space-y-1">
            <FieldLabel>Geri bildirim</FieldLabel>
            <Select
              value={value.feedbackMode ?? 'event'}
              onChange={(e) => patch({ feedbackMode: e.target.value as FeedbackMode })}
            >
              {FEEDBACK_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </Select>
          </label>
          <EventFormSlots
            slots={[value.feedbackSlot ?? emptyFeedbackSlot()]}
            eventName={value.name}
            ownerTeam={value.ownerTeam}
            startLocal={value.startDate ?? ''}
            reservedEventId={value.reservedId}
            returnTo={returnTo}
            onLeaveToSkyforms={onLeaveToSkyforms}
            addable={false}
            inUse={formInUse}
            onGateChange={(_, gate) => closeFeedbackReminders(value.reservedId, gate)}
            onChange={([feedbackSlot]) =>
              patch({ feedbackSlot: feedbackSlot ?? emptyFeedbackSlot() })
            }
          />
          <Switch
            checked={value.feedbackAutoSend ?? true}
            onChange={(checked) => patch({ feedbackAutoSend: checked })}
            label="Etkinlik bitince gönder"
            hint="Bitişten 2 saat sonra katılanlara e-postayla gider."
          />
        </div>
      </EditorSection>
      <EditorSection id="bilet" title="Bilet ve kapı">
        {notices.bilet}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <FieldLabel>Kapasite</FieldLabel>
            <Field
              type="number"
              min={0}
              value={Number.isFinite(value.capacity) ? value.capacity : 0}
              onChange={(e) => patch({ capacity: Number(e.target.value) || 0 })}
            />
          </label>
          <DatePicker
            label="Son başvuru"
            value={value.registrationClosesAt ?? ''}
            onChange={(registrationClosesAt) => patch({ registrationClosesAt })}
          />
        </div>
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
                const person = staffPeople.get(id);
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
              loading={staffSearch.loading}
              failed={staffSearch.failed}
              options={staffSearch.people
                .filter(
                  (person) =>
                    !staffIds.includes(person.id) &&
                    pickerMatch(staffQuery, person.email, person.firstName, person.lastName),
                )
                .map((person) => ({
                  id: person.id,
                  title: `${person.firstName} ${person.lastName}`.trim() || person.email,
                  subtitle: person.email,
                }))}
              emptyMessage={staffSearch.ready ? 'Kullanıcı yok' : PERSON_SEARCH_HINT}
              onPick={(picked) => {
                const person = staffSearch.people.find((row) => row.id === picked);
                if (person) setStaffPeople((known) => new Map(known).set(person.id, person));
                patch({ doorStaffIds: [...staffIds, picked] });
                setStaffOpen(false);
              }}
            />
          </div>
        ) : null}
      </EditorSection>
      <EditorSection id="sertifika" title="Sertifika">
        {notices.sertifika}
        <label className="block space-y-1">
          <FieldLabel>Sertifika kuralı</FieldLabel>
          <Select
            value={value.attendanceRule ?? 'none'}
            onChange={(e) =>
              patch({
                attendanceRule: e.target.value,
                attendanceRatio:
                  e.target.value === 'ratio'
                    ? (value.attendanceRatio ?? storedRatio ?? 0.75)
                    : undefined,
                // The threshold is chosen on the Sertifikalar tab; until then the default
                attendanceMinCount: null,
              })
            }
          >
            <option value="none">Yok</option>
            <option value="once">En az bir oturum</option>
            {legacyRules ? null : <option value="count">Oturum sayısı</option>}
            {/* A new ratio is refused by core: only an Event that has one keeps it */}
            {legacyRules || storedRatio ? (
              <option value="ratio">
                {legacyRules ? 'Oran' : `Oran (%${Math.round((storedRatio ?? 0) * 100)})`}
              </option>
            ) : null}
          </Select>
        </label>
        {!legacyRules && (value.attendanceRule === 'count' || value.attendanceRule === 'ratio') ? (
          certificatesHref ? (
            <Link
              href={certificatesHref}
              className={`text-skylab-300 hover:text-foreground inline-flex items-center gap-1 ${TEXT_SECONDARY}`}
            >
              Eşiği ve oturumları Sertifikalar sekmesinde seç
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : (
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Varsayılan eşik %75</p>
          )
        ) : null}
        {legacyRules && value.attendanceRule === 'ratio' ? (
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
      </EditorSection>
      <EditorSection id="yayin" title="Görünürlük ve yayın">
        {notices.yayin}
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
          checked={value.ranked}
          onChange={(checked) => patch({ ranked: checked })}
          label="Sıralamalı"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <FieldLabel>Ödül</FieldLabel>
            <Field
              value={value.prizeInfo ?? ''}
              onChange={(e) => patch({ prizeInfo: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>LinkedIn</FieldLabel>
            <Field
              value={value.linkedin ?? ''}
              onChange={(e) => patch({ linkedin: e.target.value })}
            />
          </label>
        </div>
      </EditorSection>
    </div>
  );
}
