import {
  daysLeft,
  deadlineBadge,
  describeFields,
  formatDay,
  todayInTurkey,
} from './subject-requests';

describe('subject request deadlines', () => {
  it('counts today in Turkey, not UTC', () => {
    // 22:30 UTC on the 26th is already the 27th in Istanbul
    expect(todayInTurkey(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-27');
    expect(todayInTurkey(new Date('2026-10-26T20:30:00Z'))).toBe('2026-10-26');
  });

  it('counts whole days to the due date', () => {
    expect(daysLeft('2026-11-26', '2026-10-27')).toBe(30);
    expect(daysLeft('2026-10-27', '2026-10-27')).toBe(0);
    expect(daysLeft('2026-10-26', '2026-10-27')).toBe(-1);
    // Across the end of daylight saving in Europe
    expect(daysLeft('2026-11-01', '2026-10-24')).toBe(8);
  });

  it('badges an open request 7 days or less from its due date, or past it', () => {
    const today = '2026-10-27';
    expect(deadlineBadge({ status: 'received', dueOn: '2026-11-04' }, today)).toBeNull();
    expect(deadlineBadge({ status: 'received', dueOn: '2026-11-03' }, today)).toEqual({
      label: '7 gün kaldı',
      kind: 'pending',
    });
    expect(deadlineBadge({ status: 'awaiting_verification', dueOn: '2026-10-28' }, today)).toEqual({
      label: '1 gün kaldı',
      kind: 'pending',
    });
    expect(deadlineBadge({ status: 'received', dueOn: today }, today)).toEqual({
      label: 'Bugün son gün',
      kind: 'cancelled',
    });
    expect(deadlineBadge({ status: 'received', dueOn: '2026-10-20' }, today)).toEqual({
      label: 'Süre geçti',
      kind: 'cancelled',
    });
  });

  it('badges no concluded request, however late', () => {
    expect(deadlineBadge({ status: 'answered', dueOn: '2026-01-01' }, '2026-10-27')).toBeNull();
    expect(deadlineBadge({ status: 'rejected', dueOn: '2026-10-28' }, '2026-10-27')).toBeNull();
  });

  it('formats days and trail fields', () => {
    expect(formatDay('2026-10-27')).toBe('27.10.2026');
    expect(formatDay(null)).toBe('');
    expect(describeFields(['status', 'answeredOn', 'unknown'])).toBe(
      'durum, cevap tarihi, unknown',
    );
  });
});
