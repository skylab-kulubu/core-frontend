/** @jest-environment node */

import type { CoreEvent } from '@/lib/api/events';
import { formStateFromEvent } from '@/lib/event-draft';
import { changeNoticeFor, changeNoticeTitle } from '@/lib/scheduling/change-notice';

const now = new Date('2026-11-25T12:00:00Z');

const published: CoreEvent = {
  id: 'e1',
  name: 'Gece Kodu',
  description: '',
  location: 'D-Blok',
  ownerTeam: 'GECEKODU',
  capacity: 0,
  status: 'published',
  startDate: '2026-12-04T15:00:00.000Z',
  endDate: '2026-12-04T18:00:00.000Z',
  ticketCount: 12,
  active: true,
  ranked: false,
  createdAt: '',
  updatedAt: '',
};

describe('changeNoticeFor (the save asks whether the ticket holders are told)', () => {
  const base = formStateFromEvent(published);

  it('asks for a new time or place of a published event, with its ticket count', () => {
    expect(changeNoticeFor(published, { ...base, location: 'Oditoryum' }, base, now)).toEqual({
      changes: ['place'],
      holders: 12,
    });
    expect(
      changeNoticeFor(
        published,
        { ...base, location: 'Oditoryum', startDate: '2026-12-05T18:00' },
        base,
        now,
      ),
    ).toEqual({ changes: ['time', 'place'], holders: 12 });
  });

  it('asks without a count when the count is not known', () => {
    const unknown = { ...published, ticketCount: undefined };
    expect(changeNoticeFor(unknown, { ...base, location: 'Oditoryum' }, base, now)).toEqual({
      changes: ['place'],
      holders: null,
    });
  });

  it('does not ask for anything else, a draft, a cancelled or ended event, or no tickets', () => {
    const moved = { ...base, location: 'Oditoryum' };
    expect(changeNoticeFor(published, { ...base, name: 'Gece Kodu 2026' }, base, now)).toBeNull();
    expect(changeNoticeFor({ ...published, status: 'draft' }, moved, base, now)).toBeNull();
    expect(changeNoticeFor({ ...published, status: 'cancelled' }, moved, base, now)).toBeNull();
    expect(changeNoticeFor({ ...published, ticketCount: 0 }, moved, base, now)).toBeNull();
    expect(changeNoticeFor(published, moved, base, new Date('2026-12-05T00:00:00Z'))).toBeNull();
  });

  it('titles the question after what changed', () => {
    expect(changeNoticeTitle(['time'])).toBe('Etkinliğin saati değişti');
    expect(changeNoticeTitle(['place'])).toBe('Etkinliğin yeri değişti');
    expect(changeNoticeTitle(['time', 'place'])).toBe('Etkinliğin saati ve yeri değişti');
  });
});
