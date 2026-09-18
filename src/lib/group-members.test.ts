import { memberSourceLabel, memberSubtitle } from './group-members';

describe('member source label', () => {
  it('names the subgroup path from the parent', () => {
    expect(memberSourceLabel('/UYELER/YK', '/UYELER/YK/LIDERLER')).toBe('YK / LIDERLER');
    expect(memberSourceLabel('/UYELER/YK', '/UYELER/YK/BASKAN/YARDIMCI')).toBe(
      'YK / BASKAN / YARDIMCI',
    );
  });

  it('stays quiet for a direct parent member', () => {
    expect(memberSourceLabel('/UYELER/YK', '/UYELER/YK')).toBeUndefined();
    expect(memberSourceLabel('/UYELER/YK', undefined)).toBeUndefined();
  });
});

describe('member subtitle', () => {
  it('puts the source in front of email when nested', () => {
    expect(
      memberSubtitle('/UYELER/YK', {
        email: 'ada@example.com',
        sourceGroupPath: '/UYELER/YK/LIDERLER',
      }),
    ).toBe('YK / LIDERLER · ada@example.com');
  });

  it('keeps email only for a direct member', () => {
    expect(memberSubtitle('/UYELER/YK', { email: 'ada@example.com' })).toBe('ada@example.com');
  });
});
