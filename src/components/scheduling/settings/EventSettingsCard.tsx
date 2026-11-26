'use client';

import { cn } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { SettingsSaveBar } from '@/components/chrome/SettingsPage';
import { StateCard } from '@/components/chrome/StateCard';
import type { EventFieldsProps, EventFormState } from '@/components/scheduling/EventEditor';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { useChangeNoticeQuestion } from '@/components/scheduling/use-change-notice-question';
import type { CoreEvent } from '@/lib/api/events';
import { coreProblemMessage } from '@/lib/core-problems';
import type { EventMediaHint } from '@/lib/event-media';
import { eventFormIssue } from '@/lib/events-view';
import { useNotify } from '@/lib/ui/use-notify';

/** The fields a card holds: it saves these and nothing else. */
export type CardFields = readonly (keyof EventFormState)[];

/** The card's fields of `form`, comparable: a form slot's generated key is no change. */
function comparable(form: Partial<EventFormState>, fields: CardFields): string {
  return JSON.stringify(
    fields.map((field) => {
      const value = form[field];
      if (field === 'formSlots' && Array.isArray(value)) {
        return (value as EventFormState['formSlots']).map((slot) => ({ ...slot, key: undefined }));
      }
      if (field === 'feedbackSlot' && value && typeof value === 'object') {
        return { ...(value as object), key: undefined };
      }
      return value ?? null;
    }),
  );
}

/** Whether `draft` changes any of the card's fields of `base`. */
export function cardChanged(
  base: EventFormState,
  draft: Partial<EventFormState>,
  fields: CardFields,
): boolean {
  return comparable(base, fields) !== comparable({ ...base, ...draft }, fields);
}

function pick(form: EventFormState, fields: CardFields): Partial<EventFormState> {
  return Object.fromEntries(fields.map((field) => [field, form[field]]));
}

/**
 * One card's work on the saved event: what is typed in it (nothing until the reader types, so it
 * follows the saved event), whether it differs, and its save. A save sends only the card's
 * fields; a problem another card would fix does not hold it.
 */
export function useEventCard(id: string, fields: CardFields) {
  const { editor } = useEventWorkspace();
  const base = editor.base as EventFormState;
  // What came back from Skyforms and was not saved starts in its card, unsaved
  const [draft, setDraft] = useState<Partial<EventFormState> | null>(() =>
    editor.pending && cardChanged(base, editor.pending, fields)
      ? pick(editor.pending, fields)
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askChangeNotice, changeNoticeDialog] = useChangeNoticeQuestion();
  const notify = useNotify();
  const value: EventFormState = draft ? { ...base, ...draft } : base;
  const dirty = draft !== null && cardChanged(base, draft, fields);

  const { markDirty } = editor;
  useEffect(() => {
    markDirty(id, dirty);
    return () => markDirty(id, false);
  }, [id, dirty, markDirty]);

  function patch(partial: Partial<EventFormState>) {
    setDraft((current) => ({ ...(current ?? pick(base, fields)), ...partial }));
  }

  function discard() {
    setDraft(null);
    setError(null);
  }

  /** Saves the card; true once core took it. */
  async function save(): Promise<boolean> {
    if (!dirty || saving) return false;
    const issue = eventFormIssue(value);
    // A problem of the saved event itself belongs to another card
    if (issue && issue !== eventFormIssue(base)) {
      setError(issue);
      return false;
    }
    // A new time or place of a published event: ask whether its ticket holders are told
    const notice = editor.changeNotice(value);
    const notifyTicketHolders = notice ? await askChangeNotice(notice) : false;
    if (notifyTicketHolders === null) return false;
    setSaving(true);
    setError(null);
    try {
      await editor.save(value, { notifyTicketHolders });
      setDraft(null);
      notify.success('Etkinlik kaydedildi');
      return true;
    } catch (err) {
      setError(coreProblemMessage(err, 'Kaydedilemedi'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    fields: { value, patch } satisfies EventFieldsProps,
    dirty,
    saving,
    error,
    save,
    discard,
    dialog: changeNoticeDialog,
  };
}

/** Lands on the card a link names (#kapi-gorevlileri), once it is drawn. */
function useScrollToCard(id: string) {
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
  }, [id]);
}

/** A card's frame: its title, an optional control beside it, its content; reachable by `#id`. */
export function EventCardFrame({
  id,
  title,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useScrollToCard(id);
  return (
    <section id={id} aria-label={title} className="min-w-0 scroll-mt-28 md:scroll-mt-16">
      <ObjectCard title={title} action={action} className={cn('gap-4 sm:p-5', className)}>
        {children}
      </ObjectCard>
    </section>
  );
}

/**
 * A card of the event's settings with its own Kaydet and Vazgeç: they come up at the card's foot
 * while it holds a change and stay in sight as the page scrolls. A save stays on the page.
 * `afterSave` runs once core took the card (the form's ticket question).
 */
export function EventSettingsCard({
  id,
  title,
  fields,
  action,
  afterSave,
  children,
}: {
  id: string;
  title: string;
  fields: CardFields;
  action?: ReactNode;
  afterSave?: (saved: EventFormState) => void | Promise<void>;
  children: (fields: EventFieldsProps) => ReactNode;
}) {
  const card = useEventCard(id, fields);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const saved = card.fields.value;
    if (await card.save()) await afterSave?.(saved);
  };
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="min-w-0">
      <EventCardFrame id={id} title={title} action={action}>
        {children(card.fields)}
        <SettingsSaveBar
          visible={card.dirty || card.saving || Boolean(card.error)}
          saving={card.saving}
          canSave={card.dirty}
          error={card.error}
          onDiscard={card.discard}
        />
      </EventCardFrame>
      {card.dialog}
    </form>
  );
}

/**
 * A page of cards that change the event: who may not edit it is told so, and the cards wait
 * until the saved event is read.
 */
export function EventSettingsCards({ children }: { children: ReactNode }) {
  const { canMutate, editor } = useEventWorkspace();
  if (!canMutate) {
    return <StateCard title="Bu etkinliği düzenleme yetkin yok" tone="danger" />;
  }
  if (!editor.ready) return <StateCard title="Yükleniyor…" isLoading />;
  return <div className="flex max-w-3xl min-w-0 flex-col gap-4">{children}</div>;
}

/** The saved cover and gallery, so their pickers show them before anything is uploaded. */
export function eventKnownMedia(
  event: Pick<CoreEvent, 'coverImageId' | 'coverImageUrl' | 'images'>,
): EventMediaHint[] {
  return [
    ...(event.coverImageId
      ? [{ id: event.coverImageId, name: 'Kapak', url: event.coverImageUrl }]
      : []),
    ...(event.images ?? []).map((image) => ({ id: image.id, url: image.url })),
  ];
}
