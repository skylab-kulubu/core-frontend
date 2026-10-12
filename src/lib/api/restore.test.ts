/** @jest-environment node */

import { competitorsApi } from '@/lib/api/competitors';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi } from '@/lib/api/seasons';
import { sessionsApi } from '@/lib/api/sessions';
import { urlsApi } from '@/lib/api/urls';

describe('core restore calls behind Geri al', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('POSTs to the restore (or reinstate) route of each removal core can undo', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method} ${new URL(String(input)).pathname}`);
      return Response.json({});
    }) as typeof fetch;

    await eventsApi.restore('e1');
    await eventDaysApi.restore('d1');
    await sessionsApi.restore('s1');
    await seasonsApi.restore('se1');
    await urlsApi.restore('u1');
    await competitorsApi.reinstate('c1');

    expect(calls).toEqual([
      'POST /v1/events/e1/restore',
      'POST /v1/event-days/d1/restore',
      'POST /v1/sessions/s1/restore',
      'POST /v1/seasons/se1/restore',
      'POST /v1/urls/u1/restore',
      'POST /v1/competitors/c1/reinstate',
    ]);
  });
});
