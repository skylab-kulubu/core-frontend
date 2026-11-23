'use client';

import { Button, Card, SaveStatus, cn, type SaveState } from '@skylab-kulubu/skylcn-ui';
import { Eye, PenLine, Send, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CoverField, CoverPreview } from '@/components/announcements/CoverField';
import { RichTextEditor, RichTextView } from '@/components/announcements/RichTextEditor';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import { newsApi, newsProblemMessage, type NewsData, type NewsItem } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import {
  EMPTY_NEWS_FORM,
  dataFromForm,
  formFromData,
  parseTags,
  publishBlocker,
  sameNews,
  type NewsForm,
} from '@/lib/news-editor';
import { useConfirm } from '@/lib/ui/use-confirm';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useUnsavedChanges } from '@/lib/ui/use-unsaved-changes';

/** How long typing rests before the draft is saved. */
export const AUTOSAVE_DELAY_MS = 1500;

type Source = { kind: 'new'; draft?: Partial<NewsData> | null } | { kind: 'edit'; item: NewsItem };

/** A refusal that no later autosave can get past: the item was archived or moved. */
function isFinal(err: unknown): boolean {
  return (
    err instanceof ProblemError &&
    err.status === 409 &&
    (err.fields.reason === 'archived' || err.fields.reason === 'moved')
  );
}

/**
 * The announcement editor (Ghost's layout): the title and the body in the middle, the
 * cover and the settings on the right, the save state and the publish button in a bar that
 * stays at the bottom. What is typed is kept as the writer's own draft in the CMS a moment
 * later; it reaches the site only with Yayınla.
 */
export function NewsEditor({
  source,
  onPublished,
}: {
  source: Source;
  onPublished: (item: NewsItem | undefined) => void;
}) {
  const published = source.kind === 'edit' ? formFromData(source.item.data) : EMPTY_NEWS_FORM;
  const startDraft = source.kind === 'edit' ? source.item.draftData : source.draft;
  const [form, setForm] = useState<NewsForm>(() =>
    startDraft
      ? formFromData({ ...(source.kind === 'edit' ? source.item.data : {}), ...startDraft })
      : published,
  );
  const [tagsText, setTagsText] = useState(form.tags.join(', '));
  const [hasDraft, setHasDraft] = useState(Boolean(startDraft));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stopped, setStopped] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  // What the CMS holds as the draft now (or the published text when there is none)
  const stored = useRef<NewsForm>(form);
  const slug = source.kind === 'edit' ? source.item.slug : null;
  const publishedRef = useRef(published);

  const unsynced = !sameNews(form, stored.current) || saveState === 'saving';
  const leaving = useUnsavedChanges(unsynced && !stopped);

  const persist = useCallback(
    async (next: NewsForm) => {
      if (sameNews(next, stored.current)) return;
      setSaveState('saving');
      setSaveError(null);
      try {
        if (sameNews(next, publishedRef.current)) {
          // Back to the published text: the draft has nothing left to keep
          if (slug) await newsApi.discardDraft(slug);
          else await newsApi.discardPendingDraft();
          setHasDraft(false);
        } else {
          const data = dataFromForm(next);
          if (slug) await newsApi.saveDraft(slug, data);
          else await newsApi.savePendingDraft(data);
          setHasDraft(true);
        }
        stored.current = next;
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        const message = newsProblemMessage(err, 'Taslak kaydedilemedi');
        setSaveError(message);
        if (isFinal(err)) setStopped(message);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (stopped || publishing || sameNews(form, stored.current)) return undefined;
    const timer = window.setTimeout(() => void persist(form), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [form, persist, stopped, publishing]);

  function update(change: Partial<NewsForm>) {
    setForm((current) => ({ ...current, ...change }));
    setPublishError(null);
  }

  async function publish() {
    const blocker = publishBlocker(form);
    if (blocker) {
      setPublishError(blocker);
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const data = dataFromForm(form);
      // Publishing clears the writer's draft in the CMS too
      const item =
        source.kind === 'edit'
          ? await newsApi.update(source.item.slug, data, source.item.version)
          : await newsApi.create(data);
      stored.current = form;
      leaving.allowLeave();
      onPublished(item);
    } catch (err) {
      setPublishError(
        newsProblemMessage(err, source.kind === 'edit' ? 'Güncellenemedi' : 'Yayınlanamadı'),
      );
      if (isFinal(err)) setStopped(newsProblemMessage(err, 'Yayınlanamadı'));
    } finally {
      setPublishing(false);
    }
  }

  function askDiscard() {
    confirm({
      title:
        source.kind === 'edit' ? 'Yayınlanmamış değişiklikler atılsın mı?' : 'Taslak silinsin mi?',
      description:
        source.kind === 'edit'
          ? 'Duyuru yayındaki hâline döner.'
          : 'Yazdıkların silinir; geri getirilemez.',
      actionLabel: source.kind === 'edit' ? 'Değişiklikleri at' : 'Taslağı sil',
      onConfirm: async () => {
        if (slug) await newsApi.discardDraft(slug);
        else await newsApi.discardPendingDraft();
        stored.current = publishedRef.current;
        setForm(publishedRef.current);
        setTagsText(publishedRef.current.tags.join(', '));
        setHasDraft(false);
        setSaveState('idle');
      },
      failure: (err) => newsProblemMessage(err, 'Silinemedi'),
    });
  }

  const blocker = publishBlocker(form);
  const changed = hasDraft || !sameNews(form, publishedRef.current);
  const status =
    source.kind === 'new' ? (
      <StatusChip kind="draft" label="Taslak" />
    ) : changed ? (
      <StatusChip kind="pending" label="Yayınlanmamış değişiklik" />
    ) : (
      <StatusChip kind="live" label="Yayında" />
    );

  return (
    <div className="flex flex-col gap-4">
      {stopped ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {stopped}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {status}
        {hasDraft ? (
          <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
            Taslak yalnız sana görünür
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          {previewing ? (
            <NewsPreview form={form} />
          ) : (
            <>
              <label className="block space-y-1">
                <FieldLabel>Başlık</FieldLabel>
                <Field
                  value={form.title}
                  onChange={(event) => update({ title: event.target.value })}
                  className="text-base font-semibold"
                />
              </label>
              <label className="block space-y-1">
                <FieldLabel>Özet</FieldLabel>
                <TextArea
                  rows={2}
                  value={form.summary}
                  onChange={(event) => update({ summary: event.target.value })}
                />
              </label>
              <div className="space-y-1">
                <FieldLabel>İçerik</FieldLabel>
                <RichTextEditor
                  label="İçerik"
                  value={form.body}
                  onChange={(body) => update({ body })}
                />
              </div>
            </>
          )}
        </div>
        <Card className="flex h-fit flex-col gap-4 p-4">
          <div className="space-y-1">
            <FieldLabel>Kapak görseli</FieldLabel>
            <CoverField value={form.heroImage} onChange={(heroImage) => update({ heroImage })} />
          </div>
          <label className="block space-y-1">
            <FieldLabel>Etiketler</FieldLabel>
            <Field
              placeholder="Virgülle ayır"
              value={tagsText}
              onChange={(event) => {
                setTagsText(event.target.value);
                update({ tags: parseTags(event.target.value) });
              }}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Yazar</FieldLabel>
            <Field
              value={form.author}
              onChange={(event) => update({ author: event.target.value })}
            />
          </label>
          <Switch
            checked={form.featured}
            onChange={(featured) => update({ featured })}
            label="Öne çıkar"
          />
        </Card>
      </div>
      <div
        role="region"
        aria-label="Yayın"
        className="border-border-subtle bg-background/95 sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t px-1 py-2 backdrop-blur"
      >
        <div className="contents">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <SaveStatus state={saveState} error={saveError ?? undefined} />
            {publishError ? (
              <span role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
                {publishError}
              </span>
            ) : null}
          </div>
          {hasDraft ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={BUTTON_TEXT}
              onClick={askDiscard}
            >
              <Undo2 aria-hidden />
              {source.kind === 'edit' ? 'Değişiklikleri at' : 'Taslağı sil'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={BUTTON_TEXT}
            aria-pressed={previewing}
            onClick={() => setPreviewing((value) => !value)}
          >
            {previewing ? <PenLine aria-hidden /> : <Eye aria-hidden />}
            {previewing ? 'Düzenle' : 'Önizle'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className={cn(BUTTON_TEXT)}
            disabled={publishing || Boolean(stopped) || (source.kind === 'edit' && !changed)}
            title={blocker ?? undefined}
            onClick={() => void publish()}
          >
            <Send aria-hidden />
            {publishing ? 'Yayınlanıyor…' : source.kind === 'edit' ? 'Güncelle' : 'Yayınla'}
          </Button>
        </div>
      </div>
      {confirmDialog}
      {leaving.dialog}
    </div>
  );
}

/** The announcement as a reader will see it: cover whole, title, summary, body, tags. */
function NewsPreview({ form }: { form: NewsForm }) {
  return (
    <article
      aria-label="Önizleme"
      className="bg-card border-border-subtle space-y-3 rounded-lg border p-4 sm:p-6"
    >
      {form.heroImage.trim() ? <CoverPreview src={form.heroImage} /> : null}
      <h2 className="text-foreground-strong text-2xl leading-tight font-semibold">
        {form.title.trim() || 'Başlıksız duyuru'}
      </h2>
      {form.summary.trim() ? (
        <p className="text-secondary-foreground text-[15px]/6">{form.summary}</p>
      ) : null}
      {form.author.trim() || form.tags.length ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          {[form.author.trim(), form.tags.join(', ')].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <RichTextView html={form.body} />
    </article>
  );
}
