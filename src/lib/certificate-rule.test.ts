import type { CertificateRule, CertificateRuleSession } from '@/lib/api/certificates';
import {
  countedByDefault,
  countedTotal,
  defaultMin,
  effectiveMin,
  minFromRatio,
  percentOf,
  ruleIssues,
  ruleSummaryParts,
  withMark,
} from '@/lib/certificate-rule';

function session(id: string, extra: Partial<CertificateRuleSession> = {}): CertificateRuleSession {
  return {
    id,
    dayId: 'd1',
    title: id,
    sessionType: 'WORKSHOP',
    cancelled: false,
    counted: true,
    required: false,
    ...extra,
  };
}

function rule(extra: Partial<CertificateRule>): CertificateRule {
  return {
    rule: 'count',
    minCount: null,
    effectiveMin: 0,
    countedTotal: 0,
    sessions: [],
    ...extra,
  };
}

describe('certificate rule arithmetic', () => {
  it('writes the threshold as a whole percentage', () => {
    expect(percentOf(6, 8)).toBe(75);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(0, 0)).toBe(0);
  });

  it('defaults to ⌈3N/4⌉ in integers, as core does', () => {
    expect([0, 1, 3, 4, 8, 10].map(defaultMin)).toEqual([0, 1, 3, 3, 6, 8]);
    expect(effectiveMin(null, 8)).toBe(6);
    // A threshold above N applies as N
    expect(effectiveMin(6, 4)).toBe(4);
  });

  it('turns an older ratio into the count it stands for', () => {
    expect(minFromRatio(0.66, 3)).toBe(2);
    expect(minFromRatio(0.67, 3)).toBe(3);
    expect(minFromRatio(0.75, 8)).toBe(6);
    expect(minFromRatio(0.01, 8)).toBe(1);
  });

  it('counts live counted Sessions only', () => {
    expect(
      countedTotal([
        session('a'),
        session('b', { counted: false }),
        session('c', { cancelled: true }),
      ]),
    ).toBe(1);
  });
});

describe('withMark', () => {
  it('ticks Sayılır with Zorunlu and keeps it locked while required', () => {
    const required = withMark({ counted: false, required: false }, 'required', true);
    expect(required).toEqual({ counted: true, required: true });
    expect(withMark(required, 'counted', false)).toEqual({ counted: true, required: true });
    const freed = withMark(required, 'required', false);
    expect(freed).toEqual({ counted: true, required: false });
    expect(withMark(freed, 'counted', false)).toEqual({ counted: false, required: false });
  });
});

describe('ruleSummaryParts', () => {
  it('says the threshold, the required Sessions and the uncounted ones', () => {
    const sessions = [
      session('Açılış', { required: true }),
      ...['b', 'c', 'd', 'e', 'f', 'g'].map((id) => session(id)),
      session('Final', { required: true }),
      session('Networking', { counted: false }),
      session('Ara', { counted: false }),
      session('İptal', { cancelled: true, counted: false }),
    ];
    expect(ruleSummaryParts(rule({ sessions }))).toEqual([
      '8 oturumdan en az 6 (%75)',
      'Zorunlu: Açılış, Final',
      '2 oturum sayılmıyor',
    ]);
  });

  it('says an older ratio and the other rules plainly', () => {
    const sessions = ['a', 'b', 'c'].map((id) => session(id));
    expect(
      ruleSummaryParts(rule({ rule: 'ratio', ratio: 0.67, effectiveMin: 3, sessions })),
    ).toEqual(['3 oturumdan en az 3 (%100)', 'eski oran %67']);
    expect(ruleSummaryParts(rule({ rule: 'once', sessions }))).toEqual(['En az bir oturum']);
    expect(ruleSummaryParts(rule({ rule: 'none', sessions }))).toEqual(['Sertifika yok']);
    expect(ruleSummaryParts(rule({ sessions: [] }))).toEqual(['Sayılan oturum yok']);
  });
});

describe('ruleIssues', () => {
  const sessions = ['a', 'b', 'c', 'd'].map((id) => session(id));

  it('keeps the threshold between 1 and N', () => {
    expect(ruleIssues({ rule: 'count', minCount: 3, sessions })).toEqual({});
    expect(ruleIssues({ rule: 'count', minCount: null, sessions })).toEqual({});
    expect(ruleIssues({ rule: 'count', minCount: 5, sessions }).minCount).toBe(
      '1 ile 4 arasında olmalı',
    );
    expect(ruleIssues({ rule: 'count', minCount: 0, sessions }).minCount).toBeDefined();
    expect(ruleIssues({ rule: 'count', minCount: Number.NaN, sessions }).minCount).toBeDefined();
  });

  it('refuses a required Session that is not counted and a rule that counts nothing', () => {
    expect(
      ruleIssues({
        rule: 'once',
        minCount: null,
        sessions: [session('a', { required: true, counted: false })],
      }).sessions,
    ).toBe('Zorunlu oturum sayılmalı');
    expect(
      ruleIssues({ rule: 'count', minCount: null, sessions: [session('a', { counted: false })] })
        .sessions,
    ).toBe('En az bir oturum sayılmalı');
    expect(ruleIssues({ rule: 'none', minCount: 9, sessions: [] })).toEqual({});
  });
});

it('does not count a new networking Session by default', () => {
  expect(countedByDefault('NETWORKING')).toBe(false);
  expect(countedByDefault('WORKSHOP')).toBe(true);
});
