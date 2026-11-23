'use client';

import { Button, Card, cn } from '@skylab-kulubu/skylcn-ui';
import { useId, type FormEvent, type ReactNode } from 'react';
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
 *   <DangerSection title="Grubu sil" actionLabel="Sil" onAction={askDelete} />
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
  /** Why the last save failed, said in the bar. */
  error?: string | null;
  onSave: () => void | Promise<unknown>;
  /** Puts every field back as it was saved. */
  onDiscard: () => void;
  saveLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const { dialog } = useUnsavedChanges(dirty && !saving);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dirty && !saving) void onSave();
  };
  return (
    <form onSubmit={submit} className={cn('flex max-w-3xl flex-col gap-4', className)} noValidate>
      {children}
      <SettingsSaveBar
        visible={dirty || saving || Boolean(error)}
        saving={saving}
        error={error}
        saveLabel={saveLabel}
        onDiscard={onDiscard}
      />
      {dialog}
    </form>
  );
}

/** One subject of the settings: a short title, no paragraph under it, then its fields. */
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
  const id = useId();
  return (
    <Card className={cn('flex flex-col gap-4 p-4 sm:p-5', className)}>
      <section aria-labelledby={id} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 id={id} className="text-foreground-strong flex-1 text-sm font-semibold">
            {title}
          </h2>
          {action}
        </div>
        {children}
      </section>
    </Card>
  );
}

/**
 * The bar at the foot of the settings while something changed: Kaydet (the form's
 * submit) and Vazgeç. It sticks to the bottom of the screen as the page scrolls.
 */
export function SettingsSaveBar({
  visible,
  saving,
  error,
  saveLabel = 'Kaydet',
  onDiscard,
}: {
  visible: boolean;
  saving: boolean;
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
        <Button type="submit" variant="primary" size="sm" className={BUTTON_TEXT} pending={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * The last card: work that cannot be taken back, such as deleting the record. Its
 * button asks in a dialog (useConfirm) before anything happens; red is kept for that
 * dialog's button, not this one (red marks errors only).
 */
export function DangerSection({
  title,
  actionLabel,
  onAction,
  disabled,
  note,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  /** One short line, only when the reader must know something first. */
  note?: string;
}) {
  const id = useId();
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
      <section aria-labelledby={id} className="min-w-0 flex-1">
        <h2 id={id} className="text-foreground-strong text-sm font-semibold">
          {title}
        </h2>
        {note ? <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>{note}</p> : null}
      </section>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={BUTTON_TEXT}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </Card>
  );
}
