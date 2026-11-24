import {
  CANCEL_NEEDS_NO_ENTRY,
  cancelShut,
  EVENT_OVER,
  eventHasEnded,
} from '@/components/scheduling/roster/ticket-cancel';

const now = new Date('2026-11-24T12:00:00+03:00');

describe('eventHasEnded', () => {
  it('counts the end as core does, a day after an undated start', () => {
    expect(eventHasEnded({ endDate: '2026-11-23T18:00:00+03:00' }, now)).toBe(true);
    expect(eventHasEnded({ endDate: '2026-11-24T18:00:00+03:00' }, now)).toBe(false);
    expect(eventHasEnded({ startDate: '2026-11-22T10:00:00+03:00' }, now)).toBe(true);
    expect(eventHasEnded({ startDate: '2026-11-24T10:00:00+03:00' }, now)).toBe(false);
    expect(eventHasEnded({}, now)).toBe(false);
    expect(eventHasEnded(null, now)).toBe(false);
  });
});

describe('cancelShut', () => {
  const entry = {
    checkIns: [{ id: 'c1', ticketId: 't1', sessionId: 's1', eventDayId: 'd1', createdAt: '' }],
  };
  it('says why the cancel cannot be pressed: the event over first, then an entry', () => {
    expect(cancelShut({ checkIns: [] }, false)).toBeNull();
    expect(cancelShut(entry, false)).toBe(CANCEL_NEEDS_NO_ENTRY);
    expect(cancelShut({ checkIns: [] }, true)).toBe(EVENT_OVER);
    expect(cancelShut(entry, true)).toBe('Etkinlik bitti');
  });
});
