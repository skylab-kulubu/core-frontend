'use client';

import { useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import type { NewsData } from '@/lib/api/cms';

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
      className="max-w-xl space-y-3"
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
      <label className="block space-y-1">
        <FieldLabel>Başlık</FieldLabel>
        <Field required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Özet</FieldLabel>
        <Field value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>İçerik</FieldLabel>
        <TextArea required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Kapak görseli</FieldLabel>
        <Field
          type="url"
          placeholder="https://…"
          value={heroImage}
          onChange={(e) => setHeroImage(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Etiketler</FieldLabel>
        <Field
          placeholder="virgülle ayır"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Yazar</FieldLabel>
        <Field value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <Switch checked={featured} onChange={setFeatured} label="Öne çıkar" />
      <SaveButton disabled={pending}>{submitLabel}</SaveButton>
    </form>
  );
}
