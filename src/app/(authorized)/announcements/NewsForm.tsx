'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton, saveClass } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import type { NewsData } from '@/lib/api/cms';
import { mediaApi } from '@/lib/api/media';
import { coreProblemMessage } from '@/lib/core-problems';
import { publicMediaUrl } from '@/lib/event-media';

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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Without a purpose (legacy), as the CMS write contract says: a purposed Media is
      // purged unless something attaches it, and cms_image is not open until the CMS has
      // its service client. The CMS stores the address.
      const media = await mediaApi.upload(file);
      setHeroImage(publicMediaUrl(media.url) || media.url);
    } catch (err) {
      setUploadError(coreProblemMessage(err, 'Görsel yüklenemedi'));
    } finally {
      setUploading(false);
    }
  }

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
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
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
      <div className="space-y-2">
        <FieldLabel>Kapak görseli</FieldLabel>
        {heroImage.trim() ? (
          <div className="flex items-center gap-2">
            <img
              src={publicMediaUrl(heroImage)}
              alt="Kapak önizlemesi"
              className="h-16 w-28 rounded-md object-cover"
            />
            <ActionButton icon={X} label="Kapağı kaldır" onClick={() => setHeroImage('')} />
          </div>
        ) : null}
        <input
          ref={coverRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          aria-label="Kapak görseli dosyası"
          className="sr-only"
          onChange={(e) => {
            void uploadCover(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className={saveClass}
          disabled={uploading}
          onClick={() => coverRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Yükleniyor…' : heroImage.trim() ? 'Görseli değiştir' : 'Görsel yükle'}
        </button>
        {uploadError ? (
          <p role="alert" className="text-2xs text-destructive">
            {uploadError}
          </p>
        ) : null}
        <Field
          type="url"
          aria-label="Kapak görseli adresi"
          placeholder="ya da adres: https://…"
          value={heroImage}
          onChange={(e) => setHeroImage(e.target.value)}
        />
      </div>
      <label className="block space-y-1">
        <FieldLabel>Etiketler</FieldLabel>
        <Field placeholder="virgülle ayır" value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Yazar</FieldLabel>
        <Field value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <Switch checked={featured} onChange={setFeatured} label="Öne çıkar" />
      <SaveButton disabled={pending || uploading}>{submitLabel}</SaveButton>
    </form>
  );
}
