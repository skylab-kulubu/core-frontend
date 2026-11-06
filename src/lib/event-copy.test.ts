import type { CapabilitiesState } from '@/lib/capabilities-context';
import { toDatetimeLocalValue } from '@/lib/date-picker';
import {
  canCopyDoorStaff,
  canCopyEvent,
  copyEnd,
  copyName,
  copySkippedLines,
  copyTargetTeams,
  defaultCopyStart,
  previousFormHref,
  previousForms,
  rememberCopySkipped,
  takeCopySkipped,
} from './event-copy';
import { DEFAULT_FORMS_ADMIN_ORIGIN } from './event-forms';

const FORM_A = '11111111-1111-4111-8111-111111111111';
const FORM_B = '22222222-2222-4222-8222-222222222222';
const formUrl = (id: string) => `https://forms.yildizskylab.com/${id}`;

function ready(data: Extract<CapabilitiesState, { status: 'ready' }>['data']): CapabilitiesState {
  return { status: 'ready', data };
}

/** A local wall-clock time as core sends it (ISO with the offset). */
function iso(y: number, m: number, d: number, h = 19, min = 0): string {
  return new Date(y, m - 1, d, h, min).toISOString();
}

describe('copy dialog defaults', () => {
  it('names the copy after the source', () => {
    expect(copyName(' Gecekodu 2026 ')).toBe('Gecekodu 2026 (kopya)');
  });

  it('starts a year later at the same time', () => {
    const now = new Date(2026, 9, 25, 12, 0);
    expect(defaultCopyStart(iso(2026, 3, 14), now)).toBe('2027-03-14T19:00');
  });

  it('takes the first same weekday after today when a year later has passed', () => {
    // 2024-03-14 is a Thursday; a year later (2025-03-14) is already past
    const now = new Date(2026, 9, 25, 12, 0); // Sunday 25 October 2026
    const start = defaultCopyStart(iso(2024, 3, 14, 18, 30), now);
    expect(start).toBe('2026-10-29T18:30');
    expect(new Date(2026, 9, 29).getDay()).toBe(new Date(2024, 2, 14).getDay());
  });

  it('never offers today itself, even later in the day', () => {
    const now = new Date(2026, 9, 25, 8, 0); // Sunday morning
    expect(defaultCopyStart(iso(2020, 10, 25, 19, 0), now)).toBe('2026-11-01T19:00');
  });

  it('offers no start when the source has none', () => {
    expect(defaultCopyStart(undefined)).toBe('');
  });

  it('moves the end by the distance the start moves', () => {
    const source = { startDate: iso(2026, 3, 14, 19), endDate: iso(2026, 3, 15, 3) };
    expect(copyEnd(source, '2027-03-14T19:00')).toBe(
      toDatetimeLocalValue(new Date(2027, 2, 15, 3, 0)),
    );
    expect(copyEnd({ startDate: source.startDate }, '2027-03-14T19:00')).toBe('');
    expect(copyEnd(source, '')).toBe('');
  });
});

describe('copy rights from core', () => {
  const leader = ready({
    teams: [
      { team: 'GECEKODU', can: { 'event.create': true, 'event.update': true } },
      { team: 'AIRLAB', can: { 'event.create': true } },
      { team: 'ALGOLAB', can: { 'event.create': false } },
    ],
  });

  it('offers nothing until core answers or when it cannot be read', () => {
    expect(canCopyEvent({ status: 'loading' }, 'GECEKODU')).toBe(false);
    expect(canCopyEvent({ status: 'failed' }, 'GECEKODU')).toBe(false);
    expect(copyTargetTeams({ status: 'failed' }, 'GECEKODU')).toEqual([]);
  });

  it('lists the source team first, then the other teams the reader creates in', () => {
    expect(canCopyEvent(leader, 'GECEKODU')).toBe(true);
    expect(copyTargetTeams(leader, 'GECEKODU')).toEqual(['GECEKODU', 'AIRLAB']);
  });

  it('copies into another team only for who may edit the source', () => {
    // AIRLAB: creates there, but the source's team only reads
    const reader = ready({
      teams: [
        { team: 'GECEKODU', can: { 'event.create': false, 'event.update': false } },
        { team: 'AIRLAB', can: { 'event.create': true } },
      ],
    });
    expect(canCopyEvent(reader, 'GECEKODU')).toBe(false);
    expect(copyTargetTeams(reader, 'GECEKODU')).toEqual([]);
  });

  it('may copy only into another team when it cannot create in the source team', () => {
    const editor = ready({
      teams: [
        { team: 'GECEKODU', can: { 'event.create': false, 'event.update': true } },
        { team: 'AIRLAB', can: { 'event.create': true } },
      ],
    });
    expect(canCopyEvent(editor, 'GECEKODU')).toBe(true);
    expect(copyTargetTeams(editor, 'GECEKODU')).toEqual(['AIRLAB']);
  });

  it('adds every team of the list the reader is not in when core allows other teams', () => {
    const admin = ready({
      teams: [{ team: 'GECEKODU', can: { 'event.create': true, 'event.update': true } }],
      otherTeams: { can: { 'event.create': true, 'event.update': true } },
    });
    expect(canCopyEvent(admin, 'AIRLAB')).toBe(true);
    expect(copyTargetTeams(admin, 'AIRLAB', ['AIRLAB', 'GECEKODU', 'ALGOLAB'])).toEqual([
      'AIRLAB',
      'GECEKODU',
      'ALGOLAB',
    ]);
  });

  it('asks core whether door staff may be copied into the team', () => {
    const state = ready({
      teams: [{ team: 'GECEKODU', can: { 'event.assignDoorStaff': true } }],
      otherTeams: { can: { 'event.assignDoorStaff': false } },
    });
    expect(canCopyDoorStaff(state, 'GECEKODU')).toBe(true);
    expect(canCopyDoorStaff(state, 'AIRLAB')).toBe(false);
    expect(canCopyDoorStaff({ status: 'failed' }, 'GECEKODU')).toBe(false);
  });
});

describe('what the copy left out', () => {
  it('says each part in one line', () => {
    expect(copySkippedLines(['certificateTemplate', 'doorStaff', 'later'])).toEqual([
      'Sertifika şablonu bağlaması kopyalanmadı: bu ekipte şablon bağlama yetkin yok.',
      'Kapı görevlileri kopyalanmadı: bu ekipte görevli atama yetkin yok.',
      'Kopyalanmadı: later.',
    ]);
  });

  it('is kept for the copy page once', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    rememberCopySkipped(storage, 'c1', ['cover']);
    expect(takeCopySkipped(storage, 'c1')).toEqual(['cover']);
    expect(takeCopySkipped(storage, 'c1')).toEqual([]);
    rememberCopySkipped(storage, 'c2', []);
    expect(store.size).toBe(0);
  });
});

describe('Geçen seferin formundan yeni form', () => {
  const source = {
    formUrl: formUrl(FORM_A),
    extraFormUrls: [
      { label: 'Mentor formu', url: formUrl(FORM_B) },
      { label: 'Dış form', url: 'https://example.test/form' },
    ],
  };

  it('offers each Skyforms form of the source whose place on the copy is empty', () => {
    expect(previousForms(source, {}, DEFAULT_FORMS_ADMIN_ORIGIN)).toEqual([
      { slotKey: 'apply', label: 'Başvuru formu', formId: FORM_A },
      { slotKey: 'Mentor formu', label: 'Mentor formu', formId: FORM_B },
    ]);
  });

  it('stops offering a form once the copy has its own', () => {
    const copy = {
      formUrl: formUrl('33333333-3333-4333-8333-333333333333'),
      extraFormUrls: [
        { label: 'Mentor formu', url: formUrl('44444444-4444-4444-8444-444444444444') },
      ],
    };
    expect(previousForms(source, copy, DEFAULT_FORMS_ADMIN_ORIGIN)).toEqual([]);
  });

  it('opens Skyforms with fromForm, the copy and a way back to its form slot', () => {
    const href = previousFormHref(
      DEFAULT_FORMS_ADMIN_ORIGIN,
      'https://admin.yildizskylab.com/events/c1',
      { id: 'c1', name: 'Gecekodu 2027', ownerTeam: 'GECEKODU', startDate: iso(2027, 3, 14) },
      { slotKey: 'Mentor formu', label: 'Mentor formu', formId: FORM_B },
    );
    const url = new URL(href ?? '');
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://forms.yildizskylab.com/admin/forms/new-form',
    );
    expect(url.searchParams.get('fromForm')).toBe(FORM_B);
    expect(url.searchParams.get('eventId')).toBe('c1');
    expect(url.searchParams.get('ownerTeam')).toBe('GECEKODU');
    expect(url.searchParams.get('title')).toBe('GECEKODU Gecekodu 2027 2027 Mentor formu');
    expect(url.searchParams.get('returnTo')).toBe(
      'https://admin.yildizskylab.com/events/c1?formSlot=Mentor+formu',
    );
  });
});
