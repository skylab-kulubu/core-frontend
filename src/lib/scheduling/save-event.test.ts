/** @jest-environment node */

import { ProblemError } from '@/lib/api/core';
import { emptyEventForm } from '@/components/scheduling/EventEditor';
import type { CoreEvent } from '@/lib/api/events';
import { formStateFromEvent } from '@/lib/event-draft';
import {
  eventFieldsFromForm,
  eventPatchFromForm,
  EventSaveIncomplete,
  saveEventWithSeason,
} from '@/lib/scheduling/save-event';

const form = {
  ...emptyEventForm('GECEKODU'),
  name: 'Gecekodu',
  location: 'YTÜ',
  imageIds: ['g1'],
};

/** Core answering every call: a created or updated Event, and a failing gallery. */
function coreWithFailingGallery() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/token')) return Response.json({ token: 't' });
    if (url.endsWith('/images')) {
      return Response.json(
        { title: 'Unprocessable Content', status: 422, code: 'media_not_linkable' },
        { status: 422 },
      );
    }
    return Response.json({ id: 'e-new', name: 'Gecekodu', images: [] }, { status: 201 });
  }) as typeof fetch;
}

/** A saved Event with a Skyforms başvuru form and an external CTF form, both with links. */
const savedEvent: CoreEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'SkyDays',
  description: '',
  location: 'YTÜ',
  ownerTeam: 'GECEKODU',
  formUrl: 'https://forms.yildizskylab.com/22222222-2222-4222-8222-222222222222',
  formAlias: 'gecekodu-skydays2026',
  extraFormUrls: [{ label: 'CTF', url: 'https://ctf.example.test', alias: 'skydays-ctf2026' }],
  capacity: 0,
  startDate: '2026-05-01T09:00:00.000Z',
  active: true,
  ranked: false,
  images: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

type CoreCall = { method: string; url: string; body?: Record<string, unknown> };

/**
 * Core answering every call for `event`: creating a `taken` alias answers
 * 409, any other alias gets a new link. Returns the calls it received.
 */
function coreWithTakenAliases(event: CoreEvent, taken: string[]): CoreCall[] {
  const calls: CoreCall[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (url.includes('/api/auth/token')) return Response.json({ token: 't' });
    calls.push({ method, url, body });
    if (method === 'POST' && url.endsWith('/v1/urls')) {
      if (taken.includes(body.alias)) {
        return Response.json({ title: 'Conflict', status: 409 }, { status: 409 });
      }
      return Response.json({ id: 'u-new', ...body }, { status: 201 });
    }
    return Response.json({ ...event, ...body });
  }) as typeof fetch;
  return calls;
}

function eventUpdate(calls: CoreCall[]): Record<string, unknown> | undefined {
  return calls.find((call) => call.method === 'PATCH' && call.url.includes('/v1/events'))?.body;
}

function urlPosts(calls: CoreCall[]): unknown[] {
  return calls
    .filter((call) => call.method === 'POST' && call.url.endsWith('/v1/urls'))
    .map((call) => call.body);
}

describe('saveEventWithSeason', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('names the created Event when a later step of a new Event fails', async () => {
    coreWithFailingGallery();

    const failure = saveEventWithSeason(form);

    await expect(failure).rejects.toBeInstanceOf(EventSaveIncomplete);
    await expect(failure).rejects.toMatchObject({
      eventId: 'e-new',
      cause: expect.objectContaining({ status: 422, code: 'media_not_linkable' }),
    });
  });

  it('passes an update failure through as it is', async () => {
    coreWithFailingGallery();

    const failure = saveEventWithSeason(form, 'e-new');

    await expect(failure).rejects.toBeInstanceOf(ProblemError);
    await expect(failure).rejects.toMatchObject({ code: 'media_not_linkable' });
  });

  it('sends no active flag, which core derives from status and dates', async () => {
    const calls = coreWithTakenAliases(savedEvent, []);

    await saveEventWithSeason(formStateFromEvent(savedEvent), savedEvent.id);

    expect(eventUpdate(calls)).not.toHaveProperty('active');
  });

  it('creates every new Event as a draft, and never sends a status on update', async () => {
    const calls = coreWithTakenAliases(savedEvent, []);

    await saveEventWithSeason({ ...form, imageIds: [] });
    await saveEventWithSeason(formStateFromEvent(savedEvent), savedEvent.id);

    const create = calls.find((call) => call.method === 'POST' && call.url.endsWith('/v1/events'));
    expect(create?.body).toMatchObject({ status: 'draft' });
    expect(eventUpdate(calls)).not.toHaveProperty('status');
  });

  it('sends the applying deadline, and null to remove it', async () => {
    const calls = coreWithTakenAliases(savedEvent, []);
    const loaded = formStateFromEvent({
      ...savedEvent,
      registrationClosesAt: '2026-04-30T21:00:00.000Z',
    });

    await saveEventWithSeason(loaded, savedEvent.id);
    expect(eventUpdate(calls)).toMatchObject({ registrationClosesAt: '2026-04-30T21:00:00.000Z' });

    calls.length = 0;
    await saveEventWithSeason({ ...loaded, registrationClosesAt: '' }, savedEvent.id);
    expect(eventUpdate(calls)).toMatchObject({ registrationClosesAt: null });
  });

  it('re-saving a loaded Event keeps the aliases it already saved', async () => {
    const calls = coreWithTakenAliases(savedEvent, ['gecekodu-skydays2026', 'skydays-ctf2026']);

    await saveEventWithSeason(formStateFromEvent(savedEvent), savedEvent.id);

    expect(eventUpdate(calls)).toMatchObject({
      formAlias: 'gecekodu-skydays2026',
      extraFormUrls: [{ label: 'CTF', url: 'https://ctf.example.test', alias: 'skydays-ctf2026' }],
    });
    expect(urlPosts(calls)).toEqual([
      { url: savedEvent.formUrl, alias: 'gecekodu-skydays2026' },
      { url: 'https://ctf.example.test', alias: 'skydays-ctf2026' },
    ]);
  });

  it('creates a saved alias whose link was never created under the same name', async () => {
    const calls = coreWithTakenAliases(savedEvent, []);

    await saveEventWithSeason(formStateFromEvent(savedEvent), savedEvent.id);

    expect(eventUpdate(calls)).toMatchObject({
      formAlias: 'gecekodu-skydays2026',
      extraFormUrls: [{ alias: 'skydays-ctf2026' }],
    });
  });

  it('still numbers a taken alias when the form address changed', async () => {
    const calls = coreWithTakenAliases(savedEvent, ['skydays-ctf2026']);
    const form = formStateFromEvent(savedEvent);
    const formSlots = (form.formSlots ?? []).map((slot) =>
      slot.label === 'CTF' ? { ...slot, url: 'https://ctf2.example.test' } : slot,
    );

    await saveEventWithSeason({ ...form, formSlots }, savedEvent.id);

    expect(eventUpdate(calls)).toMatchObject({
      extraFormUrls: [{ url: 'https://ctf2.example.test', alias: 'skydays-ctf2026-2026' }],
    });
  });
});

describe('eventPatchFromForm (core keeps a field left out)', () => {
  const loaded = formStateFromEvent({
    ...savedEvent,
    endDate: '2026-05-01T17:00:00.000Z',
    linkedin: 'https://linkedin.com/x',
    prizeInfo: 'Kupa',
    capacity: 40,
    coverImageId: '33333333-3333-4333-8333-333333333333',
    attendanceRule: 'ratio',
    attendanceRatio: 0.5,
    seasonId: '44444444-4444-4444-8444-444444444444',
  });

  it('sends only what changed since the form opened', () => {
    expect(eventPatchFromForm(loaded, loaded)).toEqual({});
    expect(eventPatchFromForm({ ...loaded, prizeInfo: 'Madalya' }, loaded)).toEqual({
      prizeInfo: 'Madalya',
    });
  });

  it.each([
    ['end date', { endDate: '' }, { endDate: null }],
    ['capacity', { capacity: 0 }, { capacity: 0 }],
    ['prize', { prizeInfo: '' }, { prizeInfo: null }],
    ['LinkedIn', { linkedin: '' }, { linkedin: null }],
    ['cover', { coverImageId: '' }, { coverImageId: null }],
    ['description', { description: 'x' }, { description: 'x' }],
    [
      'certificate rule (the ratio goes with it)',
      { attendanceRule: 'once' },
      { attendanceRule: 'once', attendanceRatio: null },
    ],
  ])('clears the %s with an explicit value', (_name, change, expected) => {
    expect(eventPatchFromForm({ ...loaded, ...change }, loaded)).toEqual(expected);
  });

  it('clears the forms with null and an empty list', () => {
    // The apply slot emptied and the extra form removed
    const [apply] = loaded.formSlots;
    const cleared = { ...loaded, formSlots: [{ ...apply!, url: '', alias: '', saved: undefined }] };
    const patch = eventPatchFromForm(cleared, loaded);
    expect(patch).toMatchObject({ formUrl: null, formAlias: null, extraFormUrls: [] });
    expect(patch).not.toHaveProperty('name');
  });

  it('sends every field without a base, with null for the empty ones and no status', () => {
    const fields = eventFieldsFromForm({ ...loaded, endDate: '', linkedin: '' });
    expect(fields).toMatchObject({ name: 'SkyDays', endDate: null, linkedin: null, ranked: false });
    expect(fields).not.toHaveProperty('status');
    expect(fields).not.toHaveProperty('active');
    expect(fields).not.toHaveProperty('id');
  });

  it('leaves out an empty Owner team, which core does not clear', () => {
    expect(eventFieldsFromForm({ ...loaded, ownerTeam: ' ' })).not.toHaveProperty('ownerTeam');
  });
});

describe('saveEventWithSeason and the season', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('takes an emptied season off the Event, and touches none it never had', async () => {
    const withSeason = { ...savedEvent, seasonId: '44444444-4444-4444-8444-444444444444' };
    let calls = coreWithTakenAliases(withSeason, []);
    const loaded = formStateFromEvent(withSeason);

    await saveEventWithSeason({ ...loaded, seasonId: '' }, withSeason.id, loaded);
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toContain(
      `DELETE /v1/events/${withSeason.id}/season`,
    );

    calls = coreWithTakenAliases(savedEvent, []);
    const plain = formStateFromEvent(savedEvent);
    await saveEventWithSeason(plain, savedEvent.id, plain);
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    expect(eventUpdate(calls)).toEqual({});
  });
});
