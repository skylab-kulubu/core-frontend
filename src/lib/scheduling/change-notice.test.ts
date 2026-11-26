/** @jest-environment node */

import type { CoreEvent } from '@/lib/api/events';
import { formStateFromEvent } from '@/lib/event-draft';
import { changeNoticeFor, changeNoticeTitle, detailChanges } from '@/lib/scheduling/change-notice';

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

  it('asks for other details too (core event.changed), after the time or place', () => {
    expect(
      changeNoticeFor(
        published,
        { ...base, name: 'Gece Kodu 2026', description: 'Yeni' },
        base,
        now,
      ),
    ).toEqual({ changes: ['name', 'description'], holders: 12 });
    expect(
      changeNoticeFor(published, { ...base, capacity: 40, location: 'Oditoryum' }, base, now),
    ).toEqual({ changes: ['place', 'capacity'], holders: 12 });
  });

  it('does not ask for no change, a draft, a cancelled or ended event, or no tickets', () => {
    const moved = { ...base, location: 'Oditoryum' };
    expect(changeNoticeFor(published, base, base, now)).toBeNull();
    expect(changeNoticeFor(published, { ...base, ranked: true }, base, now)).toBeNull();
    expect(
      changeNoticeFor({ ...published, status: 'draft' }, { ...base, name: 'X' }, base, now),
    ).toBeNull();
    expect(changeNoticeFor({ ...published, status: 'draft' }, moved, base, now)).toBeNull();
    expect(changeNoticeFor({ ...published, status: 'cancelled' }, moved, base, now)).toBeNull();
    expect(changeNoticeFor({ ...published, ticketCount: 0 }, moved, base, now)).toBeNull();
    expect(changeNoticeFor(published, moved, base, new Date('2026-12-05T00:00:00Z'))).toBeNull();
  });

  it('titles the question after what changed', () => {
    expect(changeNoticeTitle(['time'])).toBe('Etkinliğin saati değişti');
    expect(changeNoticeTitle(['place'])).toBe('Etkinliğin yeri değişti');
    expect(changeNoticeTitle(['time', 'place'])).toBe('Etkinliğin saati ve yeri değişti');
    expect(changeNoticeTitle(['name'])).toBe('Ad değişti');
    expect(changeNoticeTitle(['name', 'description'])).toBe('Ad ve açıklama değişti');
    expect(changeNoticeTitle(['time', 'attendeeNote', 'links'])).toBe(
      'Saat, katılımcı notu ve bağlantılar değişti',
    );
  });
});

describe('detailChanges (what core event.changed names)', () => {
  const base = formStateFromEvent({ ...published, attendeeNote: 'Kimlik getir' });

  it('names the note, the capacity and the links', () => {
    expect(detailChanges({ ...base, attendeeNote: 'Laptop getir' }, base)).toEqual([
      'attendeeNote',
    ]);
    expect(detailChanges({ ...base, capacity: 5 }, base)).toEqual(['capacity']);
    expect(detailChanges({ ...base, linkedin: 'https://linkedin.com/x' }, base)).toEqual(['links']);
    expect(
      detailChanges({ ...base, externalRegistrationUrl: 'https://kayit.example' }, base),
    ).toEqual(['links']);
  });

  it('leaves out the time, the place and a note core did not send', () => {
    expect(detailChanges({ ...base, location: 'Oditoryum' }, base)).toEqual([]);
    const noNote = formStateFromEvent(published);
    expect(detailChanges(noNote, noNote)).toEqual([]);
  });
});
