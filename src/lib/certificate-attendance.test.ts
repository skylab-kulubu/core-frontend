import type { CertificateAttendance, CertificateAttendanceRow } from '@/lib/api/certificates';
import {
  attendanceCloseLine,
  attendanceViewCounts,
  closeTimeLabel,
  issuableByHand,
  lastSessionEnded,
  lastSessionEndsAt,
  locativeAfterTime,
  meetsRule,
  needsJustification,
  rescanCount,
  searchAttendance,
  viewAttendance,
} from '@/lib/certificate-attendance';

function row(
  name: string,
  status: CertificateAttendanceRow['status'],
  attended: number,
  extra: Partial<CertificateAttendanceRow> = {},
): CertificateAttendanceRow {
  return {
    ticketId: name,
    name,
    ticketType: 'REGISTERED',
    attended,
    missingRequired: [],
    status,
    certificate: null,
    ...extra,
  };
}

const opening = { id: 's1', title: 'Açılış' };

function list(rows: CertificateAttendanceRow[]): CertificateAttendance {
  return { countedTotal: 8, effectiveMin: 6, rule: 'count', required: [opening], rows };
}

const rows = [
  row('Ayşe Yılmaz', 'eligible', 7),
  row('Burak Demir', 'below', 4),
  row('Can Aydın', 'issued', 8, {
    certificate: { serial: 'S1', issuedAt: '2026-11-20T10:00:00Z' },
  }),
  row('Deniz Kaya', 'below', 7, { missingRequired: [opening] }),
  row('Ece Şahin', 'queued', 6),
  row('Fatma Öz', 'failed', 6),
  row('Gül Ak', 'failed', 6, {
    certificate: {
      serial: 'S2',
      issuedAt: '2026-11-20T10:00:00Z',
      revokedAt: '2026-11-21T10:00:00Z',
    },
  }),
  row('Hakan Er', 'revoked', 8, {
    certificate: {
      serial: 'S3',
      issuedAt: '2026-11-20T10:00:00Z',
      revokedAt: '2026-11-21T10:00:00Z',
    },
  }),
  row('İpek Su', 'failed', 3),
];

describe('attendance list views', () => {
  it('searches by name, Turkish letters too', () => {
    expect(searchAttendance(rows, 'burak').map((r) => r.name)).toEqual(['Burak Demir']);
    expect(searchAttendance(rows, 'şahin').map((r) => r.name)).toEqual(['Ece Şahin']);
    expect(searchAttendance(rows, '')).toHaveLength(rows.length);
  });

  it('narrows to a status and counts each view over the searched rows', () => {
    expect(viewAttendance(rows, 'below').map((r) => r.name)).toEqual(['Burak Demir', 'Deniz Kaya']);
    expect(viewAttendance(rows, 'issued').map((r) => r.name)).toEqual(['Can Aydın']);
    expect(viewAttendance(rows, 'eligible').map((r) => r.name)).toEqual(['Ayşe Yılmaz']);
    expect(attendanceViewCounts(rows)).toEqual({ all: 9, eligible: 1, below: 2, issued: 1 });
    expect(attendanceViewCounts(searchAttendance(rows, 'demir'))).toEqual({
      all: 1,
      eligible: 0,
      below: 1,
      issued: 0,
    });
  });
});

describe('manual issue', () => {
  const rule = list(rows);

  it('wants a justification below the threshold or without a required Session', () => {
    expect(needsJustification(rule, rows[0])).toBe(false);
    expect(needsJustification(rule, rows[1])).toBe(true);
    expect(needsJustification(rule, rows[3])).toBe(true);
  });

  it('offers it only to someone with no certificate and nothing queued or failed', () => {
    expect(rows.filter(issuableByHand).map((r) => r.status)).toEqual([
      'eligible',
      'below',
      'below',
    ]);
  });

  it('makes no one eligible without a counted Session or with no rule', () => {
    expect(meetsRule({ ...rule, countedTotal: 0, effectiveMin: 0 }, row('x', 'below', 0))).toBe(
      false,
    );
    expect(meetsRule({ ...rule, rule: 'none' }, rows[0])).toBe(false);
    // `once`: core says 1, never less
    expect(meetsRule({ ...rule, rule: 'once', effectiveMin: 0 }, row('x', 'below', 0))).toBe(false);
    expect(meetsRule({ ...rule, rule: 'once', effectiveMin: 1 }, row('x', 'below', 1))).toBe(true);
  });
});

describe('rescanCount', () => {
  it('counts the eligible with no certificate, a failed job taken again; never issued, queued or revoked', () => {
    // Ayşe (eligible) and Fatma (failed, meets the rule); not Gül (revoked before), not İpek (3 of 8)
    expect(rescanCount(list(rows))).toBe(2);
  });

  it('is 0 when no one is left', () => {
    expect(rescanCount(list([rows[1], rows[2], rows[4]]))).toBe(0);
  });
});

describe('closing line', () => {
  const now = new Date('2026-11-24T08:00:00Z');

  it('reads the locative after a time aloud', () => {
    expect(locativeAfterTime(19, 0)).toBe("'da");
    expect(locativeAfterTime(18, 0)).toBe("'de");
    expect(locativeAfterTime(20, 0)).toBe("'de");
    expect(locativeAfterTime(10, 0)).toBe("'da");
    expect(locativeAfterTime(13, 0)).toBe("'te");
    expect(locativeAfterTime(14, 15)).toBe("'te");
    expect(locativeAfterTime(11, 40)).toBe("'ta");
    expect(locativeAfterTime(9, 30)).toBe("'da");
    expect(locativeAfterTime(16, 6)).toBe("'da");
    expect(locativeAfterTime(0, 0)).toBe("'da");
  });

  it('says when it closes by itself, in Istanbul time', () => {
    expect(attendanceCloseLine({ autoFinalizeAt: '2026-11-24T16:00:00Z' }, now)).toBe(
      "Katılım 24 Kasım 19:00'da kendiliğinden kapanacak",
    );
    expect(attendanceCloseLine({ autoFinalizeAt: '2026-11-24T15:00:00Z' }, now)).toBe(
      "Katılım 24 Kasım 18:00'de kendiliğinden kapanacak",
    );
  });

  it('says nothing without a time', () => {
    expect(attendanceCloseLine({}, now)).toBeNull();
  });

  it('says who closed it and when', () => {
    expect(
      attendanceCloseLine(
        { attendanceFinalizedAt: '2026-11-24T16:01:00Z', finalizedSource: 'auto' },
        now,
      ),
    ).toBe('Katılım kapandı · kendiliğinden · 24 Kasım 19:01');
    expect(
      attendanceCloseLine(
        { attendanceFinalizedAt: '2026-11-24T14:30:00Z', finalizedSource: 'manual' },
        now,
      ),
    ).toBe('Katılım kapandı · elle · 24 Kasım 17:30');
  });

  it('adds the year when it is not this year', () => {
    expect(closeTimeLabel('2025-03-01T09:00:00Z', now)).toBe('1 Mart 2025 12:00');
  });
});

describe('lastSessionEnded', () => {
  const event = {
    status: 'published',
    startDate: '2026-11-24T06:00:00Z',
    endDate: '2026-11-25T18:00:00Z',
  };
  const days = [
    { id: 'd1', endDate: '2026-11-24T17:00:00Z' },
    { id: 'd2', endDate: undefined },
  ];

  it('takes the latest live Session end, its day’s end without one, the Event’s without both', () => {
    expect(
      lastSessionEndsAt(event, days, [
        { eventDayId: 'd1', endTime: '2026-11-24T12:00:00Z' },
        { eventDayId: 'd1', endTime: '2026-11-24T20:00:00Z', cancelled: true },
        { eventDayId: 'd1' },
      ]),
    ).toBe(Date.parse('2026-11-24T17:00:00Z'));
    expect(lastSessionEndsAt(event, days, [{ eventDayId: 'd2' }])).toBe(
      Date.parse('2026-11-25T18:00:00Z'),
    );
    expect(lastSessionEndsAt(event, days, [])).toBeNull();
  });

  it('opens early finalization once the last Session is over, on a published Event only', () => {
    const sessions = [{ eventDayId: 'd1', endTime: '2026-11-24T15:00:00Z' }];
    expect(lastSessionEnded(event, days, sessions, new Date('2026-11-24T14:59:00Z'))).toBe(false);
    expect(lastSessionEnded(event, days, sessions, new Date('2026-11-24T15:00:00Z'))).toBe(true);
    expect(
      lastSessionEnded(
        { ...event, status: 'draft' },
        days,
        sessions,
        new Date('2026-11-24T16:00:00Z'),
      ),
    ).toBe(false);
  });
});
