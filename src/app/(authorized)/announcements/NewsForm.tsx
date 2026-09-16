'use client';

import { useState } from 'react';
import { Field } from '@/components/chrome/Field';
import type { NewsData } from '@/lib/api/cms';

const textareaClass =
  'focus:border-skylab-400/50 min-h-40 w-full rounded-md border border-white/10 bg-white/3 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none';

type NewsFormProps = {
  initial?: Partial<NewsData>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (data: NewsData) => Promise<void>;
};

function splitTags(raw: string): string[] | undefined {
  const tags = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export function NewsForm({ initial, submitLabel, pending, onSubmit }: NewsFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [heroImage, setHeroImage] = useState(initial?.heroImage ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const data: NewsData = {
          title: title.trim(),
          body: body.trim(),
        };
        const nextSummary = summary.trim();
        const nextHero = heroImage.trim();
        const nextAuthor = author.trim();
        const nextTags = splitTags(tags);
        if (nextSummary) data.summary = nextSummary;
        if (nextHero) data.heroImage = nextHero;
        if (nextAuthor) data.author = nextAuthor;
        if (nextTags) data.tags = nextTags;
        if (featured) data.featured = true;
        try {
          await onSubmit(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Kaydedilemedi');
        }
      }}
    >
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Field
        required
        placeholder="Başlık"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Field placeholder="Özet" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <textarea
        required
        placeholder="İçerik"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={textareaClass}
      />
      <Field
        type="url"
        placeholder="Kapak görseli URL"
        value={heroImage}
        onChange={(e) => setHeroImage(e.target.value)}
      />
      <Field
        placeholder="Etiketler (virgülle)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <Field placeholder="Yazar" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-neutral-300">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        Öne çıkar
      </label>
      <button
        type="submit"
        disabled={pending}
        className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
