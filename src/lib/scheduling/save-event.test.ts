/** @jest-environment node */

import { ProblemError } from '@/lib/api/core';
import { emptyEventForm } from '@/components/scheduling/EventEditor';
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';

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
});
