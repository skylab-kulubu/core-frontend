'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { AliasHint } from '@/components/urls/AliasHint';
import { useDirtySince } from '@/lib/ui/use-unsaved-changes';
import { useAliasHint } from '@/lib/ui/use-alias-hint';

export type LinkFormValue = { url: string; alias: string };

/**
 * A short link's target and alias, with core's availability hint under the alias. A new
 * link may leave the alias empty (core picks one); an edit keeps one. `onDirty` follows the
 * typing so the side panel asks before dropping it.
 */
export function LinkForm({
  mode,
  initial,
  currentAlias,
  onSubmit,
  onDirty,
  error,
}: {
  mode: 'create' | 'edit';
  initial?: LinkFormValue;
  /** The link's alias while editing: checking it would only say it is taken. */
  currentAlias?: string;
  onSubmit: (value: LinkFormValue) => Promise<void>;
  onDirty?: (dirty: boolean) => void;
  error?: string | null;
}) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [alias, setAlias] = useState(initial?.alias ?? '');
  const [pending, setPending] = useState(false);
  const hint = useAliasHint(alias, mode, currentAlias);
  const dirty = useDirtySince(true, { url, alias });
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  const hintId = `${mode}-alias-hint`;
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!url.trim() || hint?.blocks) return;
        setPending(true);
        try {
          await onSubmit({ url: url.trim(), alias: alias.trim() });
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="block space-y-1">
        <FieldLabel>Hedef adres</FieldLabel>
        <Field
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          required
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Kısa ad</FieldLabel>
        <Field
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          placeholder={mode === 'create' ? 'İsteğe bağlı' : undefined}
          aria-describedby={hintId}
          required={mode === 'edit'}
        />
      </label>
      <AliasHint id={hintId} hint={hint} />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <SaveButton disabled={pending || Boolean(hint?.blocks)}>
        {mode === 'create' ? (pending ? 'Kısaltılıyor…' : 'Kısalt') : 'Kaydet'}
      </SaveButton>
    </form>
  );
}
