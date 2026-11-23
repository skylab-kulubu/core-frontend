import type { NewsData } from '@/lib/api/cms';

/** What the announcement editor holds while someone writes. */
export type NewsForm = {
  title: string;
  summary: string;
  /** The body as Tiptap HTML, the format inscribed's RichText field stores. */
  body: string;
  heroImage: string;
  tags: string[];
  author: string;
  featured: boolean;
};

export const EMPTY_NEWS_FORM: NewsForm = {
  title: '',
  summary: '',
  body: '',
  heroImage: '',
  tags: [],
  author: '',
  featured: false,
};

const TAG = /<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The body as the rich text editor opens it. Announcements written before the editor (and
 * in the mobile app) are plain text: paragraphs become <p>, single line breaks <br>, so
 * the text reads as it was typed instead of running together.
 */
export function bodyToHtml(body: string | undefined): string {
  const value = (body ?? '').trim();
  if (!value) return '';
  if (TAG.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Whether the rich text holds any words (Tiptap writes "<p></p>" for an empty page). */
export function bodyHasText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length > 0
  );
}

/** Splits "a, b ,, c" into tags, dropping empties and repeats. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim();
    if (tag && !seen.has(tag.toLocaleLowerCase('tr'))) {
      seen.add(tag.toLocaleLowerCase('tr'));
      out.push(tag);
    }
  }
  return out;
}

/** The editor's fields for stored data (published, or the caller's draft over it). */
export function formFromData(data: Partial<NewsData> | undefined | null): NewsForm {
  return {
    title: data?.title ?? '',
    summary: data?.summary ?? '',
    body: bodyToHtml(data?.body),
    heroImage: data?.heroImage ?? '',
    tags: [...(data?.tags ?? [])],
    author: data?.author ?? '',
    featured: Boolean(data?.featured),
  };
}

/** What inscribed stores: empty optional fields are left out, as the old form did. */
export function dataFromForm(form: NewsForm): NewsData {
  const data: NewsData = {
    title: form.title.trim(),
    body: bodyHasText(form.body) ? form.body : '',
  };
  const summary = form.summary.trim();
  const hero = form.heroImage.trim();
  const author = form.author.trim();
  if (summary) data.summary = summary;
  if (hero) data.heroImage = hero;
  if (author) data.author = author;
  if (form.tags.length) data.tags = [...form.tags];
  if (form.featured) data.featured = true;
  return data;
}

/** Whether two forms would store the same announcement. */
export function sameNews(a: NewsForm, b: NewsForm): boolean {
  return JSON.stringify(dataFromForm(a)) === JSON.stringify(dataFromForm(b));
}

/** Why the announcement cannot be published yet, or null. inscribed requires both. */
export function publishBlocker(form: NewsForm): string | null {
  if (!form.title.trim()) return 'Başlık yaz';
  if (!bodyHasText(form.body)) return 'İçerik yaz';
  return null;
}
