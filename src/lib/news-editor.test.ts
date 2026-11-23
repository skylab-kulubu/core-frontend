import {
  EMPTY_NEWS_FORM,
  bodyHasText,
  bodyToHtml,
  dataFromForm,
  formFromData,
  parseTags,
  publishBlocker,
  sameNews,
} from './news-editor';

describe('news editor', () => {
  it('opens a plain-text body as paragraphs, and HTML as it is', () => {
    expect(bodyToHtml('Merhaba\nkulüp\n\n3 < 5 & 5 > 3')).toBe(
      '<p>Merhaba<br>kulüp</p><p>3 &lt; 5 &amp; 5 &gt; 3</p>',
    );
    expect(bodyToHtml('<p>Zaten <strong>HTML</strong></p>')).toBe(
      '<p>Zaten <strong>HTML</strong></p>',
    );
    expect(bodyToHtml(undefined)).toBe('');
    expect(bodyToHtml('  ')).toBe('');
  });

  it('counts an empty Tiptap page as no text', () => {
    expect(bodyHasText('<p></p>')).toBe(false);
    expect(bodyHasText('<p>&nbsp; </p>')).toBe(false);
    expect(bodyHasText('<p>a</p>')).toBe(true);
  });

  it('splits tags once each', () => {
    expect(parseTags(' etkinlik, ,Etkinlik, duyuru ')).toEqual(['etkinlik', 'duyuru']);
  });

  it('stores only filled optional fields, as before', () => {
    const form = { ...EMPTY_NEWS_FORM, title: ' Başlık ', body: '<p>x</p>' };
    expect(dataFromForm(form)).toEqual({ title: 'Başlık', body: '<p>x</p>' });
    expect(
      dataFromForm({
        ...form,
        summary: 'ö',
        heroImage: 'h',
        author: 'a',
        tags: ['t'],
        featured: true,
      }),
    ).toEqual({
      title: 'Başlık',
      body: '<p>x</p>',
      summary: 'ö',
      heroImage: 'h',
      author: 'a',
      tags: ['t'],
      featured: true,
    });
    expect(dataFromForm({ ...form, body: '<p></p>' }).body).toBe('');
  });

  it('reads stored data back to the same announcement', () => {
    const data = { title: 'T', body: '<p>b</p>', tags: ['x'], featured: true };
    expect(sameNews(formFromData(data), formFromData({ ...data }))).toBe(true);
    expect(sameNews(formFromData(data), formFromData({ ...data, title: 'U' }))).toBe(false);
  });

  it('asks for a title and a body before publishing', () => {
    expect(publishBlocker(EMPTY_NEWS_FORM)).toBe('Başlık yaz');
    expect(publishBlocker({ ...EMPTY_NEWS_FORM, title: 'T' })).toBe('İçerik yaz');
    expect(publishBlocker({ ...EMPTY_NEWS_FORM, title: 'T', body: '<p>b</p>' })).toBeNull();
  });
});
