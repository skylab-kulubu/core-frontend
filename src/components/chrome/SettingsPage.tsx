'use client';

import { Button, Card, cn } from '@skylab-kulubu/skylcn-ui';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { coreProblemMessage } from '@/lib/core-problems';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useUnsavedChanges } from '@/lib/ui/use-unsaved-changes';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

/**
 * A settings page or an object's "Ayarlar" (Entra Properties, Shopify settings): cards
 * by subject, one Kaydet for all of them, and the dangerous work last in its own card.
 * Kaydet · Vazgeç come up at the foot while something changed; leaving with unsaved
 * changes asks first (useUnsavedChanges).
 *
 * ```tsx
 * <SettingsPage dirty={dirty} saving={saving} error={error} onSave={save} onDiscard={reset}>
 *   <SettingsSection title="Ad ve açıklama">…fields…</SettingsSection>
 *   <SettingsSection title="Görünürlük">…</SettingsSection>
 *   <DangerSection
 *     title="Grubu sil"
 *     actionLabel="Grubu sil"
 *     confirm={{ title: '"GeceKodu" silinsin mi?', actionLabel: 'Grubu sil', onConfirm: remove }}
 *   />
 * </SettingsPage>
 * ```
 */
export function SettingsPage({
  dirty,
  saving = false,
  error,
  onSave,
  onDiscard,
  saveLabel = 'Kaydet',
  children,
  className,
}: {
  /** Something differs from what was saved. */
  dirty: boolean;
  saving?: boolean;
  /** Why the last save failed, said in the bar; the page's own words win over `onSave`'s. */
  error?: string | null;
  /**
   * Saves every card. A rejection is caught here and said in the bar (core's reason in
   * Turkish, else "Kaydedilemedi"); the typed values stay.
   */
  onSave: () => void | Promise<unknown>;
  /** Puts every field back as it was saved. */
  onDiscard: () => void;
  saveLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const { dialog } = useUnsavedChanges(dirty && !saving);
  const [refused, setRefused] = useState<string | null>(null);
  const shown = error || refused;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || saving) return;
    setRefused(null);
    Promise.resolve()
      .then(onSave)
      .catch((cause: unknown) => setRefused(coreProblemMessage(cause, 'Kaydedilemedi')));
  };
  const discard = () => {
    setRefused(null);
    onDiscard();
  };
  return (
    <form onSubmit={submit} className={cn('flex max-w-3xl flex-col gap-4', className)} noValidate>
      {children}
      <SettingsSaveBar
        visible={dirty || saving || Boolean(shown)}
        saving={saving}
        canSave={dirty}
        error={shown}
        saveLabel={saveLabel}
        onDiscard={discard}
      />
      {dialog}
    </form>
  );
}

/**
 * One subject of the settings: a short title, no paragraph under it, then its fields.
 * Drawn as the object pages' ObjectCard, so an object's overview and its settings read alike.
 */
export function SettingsSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** A small control at the end of the title row, such as a "Gelişmiş" fold. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <ObjectCard title={title} action={action} className={cn('gap-4 sm:p-5', className)}>
        {children}
      </ObjectCard>
    </section>
  );
}

/**
 * The bar at the foot of the settings while something changed: Kaydet (the form's
 * submit) and Vazgeç. It sticks to the bottom of the screen as the page scrolls.
 */
export function SettingsSaveBar({
  visible,
  saving,
  canSave = true,
  error,
  saveLabel = 'Kaydet',
  onDiscard,
}: {
  visible: boolean;
  saving: boolean;
  /** Something to save; a failure said after the fields went back shows no Kaydet. */
  canSave?: boolean;
  error?: string | null;
  saveLabel?: string;
  onDiscard: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="region"
      aria-label="Kaydedilmemiş değişiklikler"
      className="border-border bg-sheet/95 shadow-overlay sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 backdrop-blur"
    >
      <p
        role={error ? 'alert' : undefined}
        className={cn(
          'min-w-0 flex-1',
          TEXT_SECONDARY,
          error ? 'text-destructive' : 'text-secondary-foreground',
        )}
      >
        {error || 'Kaydedilmemiş değişiklik var'}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BUTTON_TEXT}
          disabled={saving}
          onClick={onDiscard}
        >
          Vazgeç
        </Button>
        {canSave || saving ? (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className={BUTTON_TEXT}
            pending={saving}
          >
            {saveLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The last card: work that cannot be taken back, such as deleting the record. Its
 * button asks in a dialog first (useConfirm, the dialog's button red); nothing happens
 * until the reader agrees. The card's own button stays neutral (red marks errors only).
 */
export function DangerSection({
  title,
  actionLabel,
  confirm,
  disabled,
  note,
}: {
  title: string;
  actionLabel: string;
  /**
   * The question: "<name> silinsin mi?", its button and the work. A throw keeps the
   * dialog open with `failure` (or core's reason) in it.
   */
  confirm: {
    title: string;
    actionLabel: string;
    onConfirm: () => void | Promise<void>;
    description?: string;
    /** As useConfirm's: the fallback text, or a function for a refusal with its own words. */
    failure?: string | ((error: unknown) => string);
  };
  disabled?: boolean;
  /** One short line, only when the reader must know something first. */
  note?: string;
}) {
  const id = useId();
  const [ask, dialog] = useConfirm();
  return (
    <Card className="p-4 sm:p-5">
      <section aria-labelledby={id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-foreground-strong text-sm font-semibold">
            {title}
          </h2>
          {note ? <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>{note}</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={BUTTON_TEXT}
          disabled={disabled}
          onClick={() => ask({ ...confirm, destructive: true })}
        >
          {actionLabel}
        </Button>
      </section>
      {dialog}
    </Card>
  );
}
