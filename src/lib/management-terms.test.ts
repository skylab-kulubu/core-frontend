import { ProblemError } from '@/lib/api/core';
import type { ManagementTerm } from '@/lib/api/management-memberships';
import {
  daysLeftLabel,
  earliestNewEnd,
  endLabel,
  holderName,
  showsManagementTerms,
  sortTerms,
  termDaysLeft,
  termProblemMessage,
  termsOff,
  termWritesAllowed,
} from '@/lib/management-terms';

const term = (over: Partial<ManagementTerm>): ManagementTerm => ({
  id: 't1',
  userId: 'u1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  groupId: 'g1',
  groupPath: '/UYELER/YK',
  role: 'board',
  status: 'active',
  endsAt: '2027-06-30T20:59:59Z',
  seasonId: 's1',
  source: 'backfill',
  startedAt: '2026-11-08T10:00:00Z',
  grantedBy: null,
  warned14dAt: null,
  warned1dAt: null,
  expiredAt: null,
  ...over,
});

describe('management terms', () => {
  it('shows the end as its Istanbul day and counts the days to it', () => {
    // 20:59:59Z is 23:59:59 in Istanbul: still 30 June
    expect(endLabel('2027-06-30T20:59:59Z')).toBe('30.06.2027');
    expect(endLabel(null)).toBe('Tarihsiz');
    expect(termDaysLeft('2027-06-30T20:59:59Z', '2027-06-16')).toBe(14);
    expect(termDaysLeft('2027-06-30T20:59:59Z', '2027-07-02')).toBe(-2);
    expect(termDaysLeft(null, '2027-06-16')).toBeNull();
    expect(daysLeftLabel(14)).toBe('14 gün');
    expect(daysLeftLabel(0)).toBe('Bugün');
    expect(daysLeftLabel(-2)).toBe('2 gün geçti');
    expect(daysLeftLabel(null)).toBe('');
  });

  it('puts expired terms first, then expiring, each by end with undated last', () => {
    const sorted = sortTerms([
      term({ id: 'a', status: 'active', endsAt: null }),
      term({ id: 'b', status: 'active', endsAt: '2027-06-30T20:59:59Z' }),
      term({ id: 'c', status: 'expiring', endsAt: '2027-06-30T20:59:59Z' }),
      term({ id: 'd', status: 'expired', endsAt: '2027-05-31T20:59:59Z' }),
      term({ id: 'e', status: 'active', endsAt: '2027-01-31T20:59:59Z' }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(['d', 'c', 'e', 'b', 'a']);
  });

  it('names an erased holder', () => {
    expect(holderName(term({}))).toBe('Ada Lovelace');
    expect(holderName(term({ firstName: '', lastName: '' }))).toBe('Silinmiş hesap');
  });

  it('takes tomorrow as the earliest new end', () => {
    expect(earliestNewEnd('2026-12-31')).toBe('2027-01-01');
  });

  it('says the term routes’ refusals in Turkish', () => {
    expect(
      termProblemMessage(new ProblemError(403, 'Forbidden', { code: 'self_extension' }), 'x'),
    ).toMatch(/Kendi görevini/);
    expect(
      termProblemMessage(
        new ProblemError(422, 'Unprocessable Entity', { code: 'term_too_long' }),
        'x',
      ),
    ).toMatch(/bir sonraki sezonun sonu/);
    expect(
      termProblemMessage(new ProblemError(409, 'Conflict', { code: 'term_not_expired' }), 'x'),
    ).toMatch(/Süresi dolmamış/);
    expect(termProblemMessage(new ProblemError(400, 'Bad Request'), 'x')).toBe(
      'Bitiş bugünden sonraki bir gün olmalı.',
    );
    expect(termProblemMessage(new ProblemError(403, 'Forbidden'), 'x')).toBe(
      'Bu işlem için yetkin yok.',
    );
    expect(termsOff(new ProblemError(404, 'Not Found'))).toBe(true);
    expect(termsOff(new ProblemError(500, 'x'))).toBe(false);
  });

  it('shows the menu to a reader of Groups or a Leader, from core’s answer only', () => {
    expect(showsManagementTerms({ status: 'loading' })).toBe(false);
    expect(showsManagementTerms({ status: 'failed' })).toBe(false);
    expect(showsManagementTerms({ status: 'ready', data: { can: { 'group.read': true } } })).toBe(
      true,
    );
    expect(
      showsManagementTerms({
        status: 'ready',
        data: { can: {}, managedTeams: [{ id: 'g', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }] },
      }),
    ).toBe(true);
    expect(showsManagementTerms({ status: 'ready', data: { can: {}, managedTeams: [] } })).toBe(
      false,
    );
  });

  it('offers changes to a writer and a Leader, not to a reader who may not write', () => {
    const ready = (can: Record<string, boolean>) => ({ status: 'ready' as const, data: { can } });
    expect(termWritesAllowed(ready({ 'group.read': true, 'group.write': true }))).toBe(true);
    // DK reads every term and changes none
    expect(termWritesAllowed(ready({ 'group.read': true, 'group.write': false }))).toBe(false);
    // A Leader is listed only the terms they may change
    expect(termWritesAllowed(ready({ 'group.read': false }))).toBe(true);
    expect(termWritesAllowed({ status: 'loading' })).toBe(false);
    expect(termWritesAllowed({ status: 'failed' })).toBe(true);
  });
});
