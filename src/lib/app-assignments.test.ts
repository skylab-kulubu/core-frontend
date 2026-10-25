import type { AppAssignment, AppAuditEntry, AppTarget } from '@/lib/api/apps';
import {
  assignedText,
  assignmentSubtitle,
  auditActionText,
  auditSubtitle,
  formatInstant,
  inheritText,
  initialRoles,
  removalText,
  targetSubtitle,
} from '@/lib/app-assignments';

const weblab: AppAssignment = {
  type: 'group',
  id: 'g-web',
  role: 'skyforms:access',
  area: 'panel',
  path: '/UYELER/ARGE/WEBLAB',
  name: 'Web Lab',
  inheritsTo: 4,
  members: 23,
  assignedBy: { id: 'u-yk', name: 'Yusuf A' },
  assignedAt: '2026-10-23T09:30:00Z',
};

describe('app assignment texts', () => {
  it('says an Istanbul time', () => {
    expect(formatInstant('2026-10-23T09:30:00Z')).toContain('12:30');
    expect(formatInstant('not a date')).toBe('');
  });

  it('says what a Group row reaches and who made it', () => {
    expect(inheritText(weblab)).toBe('Alt ekipleri de kapsar (4 grup)');
    expect(inheritText({ ...weblab, inheritsTo: 0 })).toBe('');
    expect(assignmentSubtitle(weblab, true)).toBe(
      `Grup · skyforms:access · /UYELER/ARGE/WEBLAB · Alt ekipleri de kapsar (4 grup) · 23 kişi · Yusuf A · ${formatInstant('2026-10-23T09:30:00Z')}`,
    );
    expect(removalText(weblab)).toBe(
      'Bu atama 23 kişinin erişimini kaldırır. Başka bir atamadan alanlar etkilenmez.',
    );
  });

  it('says when no audit row stands behind an assignment, only to who reads the record', () => {
    const before = { ...weblab, assignedBy: null, assignedAt: null };
    expect(assignedText(before, true)).toBe('Kayıt yok (panel öncesi ya da konsoldan)');
    expect(assignedText(before, false)).toBe('');
  });

  it('says a person row by its address', () => {
    const person: AppAssignment = {
      type: 'user',
      id: 'u-ada',
      role: 'skyforms:access',
      area: 'panel',
      name: 'Ada L',
      email: 'ada@example.com',
      inheritsTo: 0,
      members: 1,
      assignedBy: null,
      assignedAt: null,
    };
    expect(assignmentSubtitle(person, false)).toBe(
      'Kişi · skyforms:access · ada@example.com · 1 kişi',
    );
  });

  it('words each audit outcome', () => {
    const entry = (action: AppAuditEntry['action'], outcome: AppAuditEntry['outcome']) =>
      auditActionText({ action, outcome });
    expect(entry('app.assign', 'ok')).toBe('Atama');
    expect(entry('app.unassign', 'ok')).toBe('Kaldırma');
    expect(entry('app.assign', 'denied')).toBe('Atama reddedildi');
    expect(entry('app.unassign', 'failed')).toBe('Kaldırma başarısız');
    expect(entry('app.assign', 'pending')).toBe('Atama (sonuç bilinmiyor)');
    expect(
      auditSubtitle({
        id: 'r1',
        occurredAt: '2026-10-23T09:30:00Z',
        action: 'app.assign',
        outcome: 'ok',
        actor: { id: 'u-yk', name: 'Yusuf A' },
        type: 'user',
        targetId: 'u-ada',
        name: 'Ada L',
        role: 'skyforms:access',
      }),
    ).toBe(`Ada L · skyforms:access · ${formatInstant('2026-10-23T09:30:00Z')}`);
  });

  it('selects the suggested roles a target does not hold yet', () => {
    const target: AppTarget = {
      type: 'group',
      id: 'g-algo',
      path: '/UYELER/ARGE/ALGOLAB',
      name: 'ALGOLAB',
      inheritsTo: 2,
      members: 9,
      assignedRoles: ['skymail:access'],
    };
    expect(initialRoles(['skymail:access', 'skymail:templates:read'], target)).toEqual([
      'skymail:templates:read',
    ]);
    expect(initialRoles(['skymail:access'], null)).toEqual(['skymail:access']);
    expect(targetSubtitle(target)).toBe(
      '/UYELER/ARGE/ALGOLAB · Alt ekipleri de kapsar (2 grup) · 9 kişi · Atanmış: skymail:access',
    );
  });
});
