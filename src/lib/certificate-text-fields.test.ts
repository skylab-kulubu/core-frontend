import { suggestTextField } from '@/lib/certificate-text-fields';

describe('suggestTextField', () => {
  it.each([
    ['Ad Soyad', 'recipientName'],
    ['ADI SOYADI', 'recipientName'],
    ['Adı Soyadı', 'recipientName'],
    ['[İsim]', 'recipientName'],
    ['İsim Soyisim', 'recipientName'],
    ['{ad}', 'recipientName'],
    ['{{katilimci}}', 'recipientName'],
    ['{{ herhangi }}', 'recipientName'],
    ['Katılımcı Adı', 'recipientName'],
    ['KATILIMCI ADI SOYADI', 'recipientName'],
    ['Katilimci Adi', 'recipientName'],
    ['XXXXXXXX', 'recipientName'],
    ['<<Ad Soyad>>', 'recipientName'],
    ['Etkinlik Adı', 'eventName'],
    ['[Etkinlik]', 'eventName'],
    ['{{etkinlik}}', 'eventName'],
    ['gg.aa.yyyy', 'eventDates'],
    ['GG/AA/YYYY', 'eventDates'],
    ['28.11.2026', 'eventDates'],
    ['Tarih', 'eventDates'],
    ['[Etkinlik Tarihi]', 'eventDates'],
    // A decomposed ı/ş (NFD) reads as the letter
    ['Katılımcı Adı'.normalize('NFD'), 'recipientName'],
  ])('%s → %s', (text, kind) => {
    expect(suggestTextField(text)).toBe(kind);
  });

  it.each([
    'Katılım Belgesi',
    'SKY LAB',
    'Ad',
    'XX',
    'Bu belge etkinliğe katıldığını gösterir.',
    '[Logo]',
    '{}',
    '2026',
  ])('leaves "%s" a text', (text) => {
    expect(suggestTextField(text)).toBeUndefined();
  });

  it('takes a lone "Ad" only in brackets', () => {
    expect(suggestTextField('Ad')).toBeUndefined();
    expect(suggestTextField('[Ad]')).toBe('recipientName');
  });
});
