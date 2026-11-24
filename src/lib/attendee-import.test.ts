/** @jest-environment node */

import type { ImportReport } from '@/lib/api/tickets';
import {
  decodeImportFile,
  importCapacityLine,
  importFileIssue,
  importMailLine,
  importOutcomeLabel,
  importRowNote,
  importSummaryItems,
  importWrites,
} from '@/lib/attendee-import';

const base: ImportReport = {
  imported: false,
  columns: { header: true, delimiter: 'comma', email: 'E-posta' },
  summary: {
    rows: 4,
    active: 2,
    waitlisted: 1,
    full: 0,
    existing: 1,
    duplicates: 0,
    invalid: 0,
    overCapacity: 0,
    members: 1,
    guests: 2,
    unknownSessions: 0,
  },
  capacity: { capacity: 3, active: 1, free: 2, waitlistEnabled: true },
  mail: 'queued',
  rows: [],
};

describe('attendee import copy', () => {
  it('counts the rows to write and leaves out empty figures', () => {
    expect(importWrites(base)).toBe(3);
    expect(importSummaryItems(base).map((item) => item.key)).toEqual([
      'active',
      'waitlisted',
      'existing',
    ]);
  });

  it('says the capacity in the preview only', () => {
    expect(importCapacityLine(base)).toBe('Kontenjan 1/3, 2 yer boş, bekleme listesi açık.');
    expect(importCapacityLine({ ...base, imported: true })).toBeNull();
    expect(importCapacityLine({ ...base, capacity: { ...base.capacity, capacity: 0 } })).toBeNull();
  });

  it('tells the mail as core answers it', () => {
    expect(importMailLine({ ...base, mail: 'off' })).toMatch(/gönderilmez/);
    expect(importMailLine({ ...base, mail: 'on_publish' })).toMatch(/taslak/);
  });

  it('names a row and its note', () => {
    const row = {
      line: 3,
      firstName: 'Ada',
      lastName: '',
      email: 'ada@example.com',
      outcome: 'invalid' as const,
      problem: 'missing_last_name',
      account: false,
      unknownSessions: ['Kapanış'],
    };
    expect(importOutcomeLabel(row, false)).toBe('Hatalı');
    expect(importRowNote(row)).toBe('Soyad yok · Bilinmeyen oturum: Kapanış');
    expect(
      importOutcomeLabel({ ...row, outcome: 'existing', ticketStatus: 'cancelled' }, true),
    ).toBe('İptal edilmiş bileti var');
  });

  it('refuses a file over 2 MB or not a text list', () => {
    const big = { name: 'liste.csv', size: 3 * 1024 * 1024, type: 'text/csv' } as File;
    const xlsx = { name: 'liste.xlsx', size: 10, type: 'application/vnd.ms-excel' } as File;
    const ok = { name: 'liste.csv', size: 10, type: '' } as File;
    expect(importFileIssue(big)).toMatch(/2 MB/);
    expect(importFileIssue(xlsx)).toMatch(/CSV/);
    expect(importFileIssue(ok)).toBeNull();
  });
});

describe('decodeImportFile', () => {
  it('reads UTF-8, and Windows-1254 when the bytes are not UTF-8', () => {
    const utf8 = new TextEncoder().encode('Ayşe;Yılmaz');
    expect(decodeImportFile(utf8.buffer as ArrayBuffer)).toBe('Ayşe;Yılmaz');
    // "Ayşe;Yılmaz" as Excel in Turkish saves it: ş = 0xFE, ı = 0xFD
    const cp1254 = new Uint8Array([
      0x41, 0x79, 0xfe, 0x65, 0x3b, 0x59, 0xfd, 0x6c, 0x6d, 0x61, 0x7a,
    ]);
    expect(decodeImportFile(cp1254.buffer)).toBe('Ayşe;Yılmaz');
  });
});
