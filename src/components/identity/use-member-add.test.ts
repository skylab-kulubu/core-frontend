import { unverifiedAddText, unverifiedBatchText } from './use-member-add';

describe('the YTÜ question’s text', () => {
  it('names the address to check for one person', () => {
    expect(unverifiedAddText('ada@example.com')).toBe(
      'Bu hesap YTÜ hesabıyla doğrulanmamış. Yönetim yetkisi vermeden önce e-posta adresinin (ada@example.com) bu kişiye ait olduğunu kontrol et.',
    );
  });

  it('counts the unverified of a batch with the right suffix and names them', () => {
    expect(unverifiedBatchText(3, [{ name: 'Ada L', email: 'ada@example.com' }])).toBe(
      "3 kişiden 1'i YTÜ ile doğrulanmamış: Ada L (ada@example.com). E-posta adresini kontrol et.",
    );
    expect(
      unverifiedBatchText(4, [
        { name: 'Ada L', email: 'ada@example.com' },
        { name: 'Cem D', email: 'c***@example.com' },
      ]),
    ).toBe(
      "4 kişiden 2'si YTÜ ile doğrulanmamış: Ada L (ada@example.com), Cem D (c***@example.com). E-posta adreslerini kontrol et.",
    );
  });

  it('names three and counts the rest', () => {
    const people = ['Ada', 'Cem', 'Ece', 'Can', 'Naz'].map((name) => ({
      name,
      email: `${name.toLowerCase()}@example.com`,
    }));
    expect(unverifiedBatchText(6, people)).toBe(
      "6 kişiden 5'i YTÜ ile doğrulanmamış: Ada (ada@example.com), Cem (cem@example.com), Ece (ece@example.com) ve 2 kişi daha. E-posta adreslerini kontrol et.",
    );
    expect(unverifiedBatchText(4, people.slice(0, 4))).toContain("4 kişiden 4'ü");
    expect(unverifiedBatchText(4, people.slice(0, 3))).toContain("4 kişiden 3'ü");
  });
});
