'use client';

import { Button } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useId, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';
import {
  handoffTargetErrors,
  rootUrlAllowsHandoff,
  type HandoffTarget,
  type HandoffTargetInput,
} from '@/lib/handoff/targets';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

type FieldName = 'signInPath' | 'returnParam';
type SaveProblem = { detail: string; field?: FieldName };

/** Keycloak's built-in clients carry message keys such as `${client_admin-cli}` as names. */
export function targetTitle(target: HandoffTarget): string {
  const name = target.name?.trim();
  return name && !name.startsWith('${') ? name : target.clientId;
}

export function storedInput(target: HandoffTarget): HandoffTargetInput {
  return {
    enabled: target.enabled === true,
    signInPath: target.signInPath ?? '',
    returnParam: target.returnParam ?? '',
  };
}

function trimmed(input: HandoffTargetInput): HandoffTargetInput {
  return { ...input, signInPath: input.signInPath.trim(), returnParam: input.returnParam.trim() };
}

function sameInput(a: HandoffTargetInput, b: HandoffTargetInput): boolean {
  return (
    a.enabled === b.enabled && a.signInPath === b.signInPath && a.returnParam === b.returnParam
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-destructive mt-1 text-[13px]/5 leading-snug">
      {message}
    </p>
  ) : null;
}

/**
 * One site's handoff, in the list's side panel: the switch, the sign-in path, the return
 * parameter and one Kaydet. The rules are checked here as Keycloak checks them; Keycloak
 * still decides, and its Turkish reason shows by the field it names.
 */
export function HandoffTargetForm({
  target,
  onSaved,
  onForbidden,
  onDirty,
}: {
  target: HandoffTarget;
  onSaved: (target: HandoffTarget) => void;
  /** Keycloak refused the admin (403): the page hides the settings. */
  onForbidden: () => void;
  /** Unsaved typing, for the panel's guard. */
  onDirty?: (dirty: boolean) => void;
}) {
  const title = targetTitle(target);
  const id = useId();
  const stored = storedInput(target);
  const [draft, setDraft] = useState<HandoffTargetInput>(stored);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const dirty = !sameInput(draft, stored);
  const errors = dirty ? handoffTargetErrors(trimmed(draft), target.rootUrl) : {};
  const originAllowed = rootUrlAllowsHandoff(target.rootUrl);
  const canSave = dirty && !saving && !errors.signInPath && !errors.returnParam && !errors.target;
  const fieldError = (field: FieldName) =>
    errors[field] ?? (problem?.field === field ? problem.detail : undefined);
  const formError = (problem && !problem.field ? problem.detail : undefined) ?? errors.target;

  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  function edit(change: Partial<HandoffTargetInput>) {
    setDraft((current) => ({ ...current, ...change }));
    setSaved(false);
    setProblem(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setProblem(null);
    try {
      const updated = await handoffTargetsApi.update(target.clientId, trimmed(draft));
      onSaved(updated);
      setDraft(storedInput(updated));
      setSaved(true);
    } catch (error) {
      if (error instanceof HandoffProblemError && error.status === 403) {
        onForbidden();
        return;
      }
      const field =
        error instanceof HandoffProblemError &&
        (error.field === 'signInPath' || error.field === 'returnParam')
          ? error.field
          : undefined;
      setProblem({
        detail: error instanceof HandoffProblemError ? error.detail : 'Kaydedilemedi. Tekrar dene.',
        field,
      });
    } finally {
      setSaving(false);
    }
  }

  const pathError = fieldError('signInPath');
  const paramError = fieldError('returnParam');

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Switch
        checked={draft.enabled}
        label="SkyApp'ten geçiş"
        disabled={saving || (!draft.enabled && !originAllowed)}
        onChange={(enabled) => edit({ enabled })}
      />
      <label className="block space-y-1">
        <FieldLabel>Giriş kapısı yolu</FieldLabel>
        <Field
          aria-label={`Giriş kapısı yolu (${title})`}
          aria-invalid={pathError ? true : undefined}
          aria-describedby={pathError ? `${id}-path-error` : undefined}
          disabled={saving}
          value={draft.signInPath}
          onChange={(event) => edit({ signInPath: event.target.value })}
          placeholder="/auth/signin"
          spellCheck={false}
          autoComplete="off"
        />
        <FieldError id={`${id}-path-error`} message={pathError} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Dönüş parametresi</FieldLabel>
        <Field
          aria-label={`Dönüş parametresi (${title})`}
          aria-invalid={paramError ? true : undefined}
          aria-describedby={paramError ? `${id}-param-error` : undefined}
          disabled={saving}
          value={draft.returnParam}
          onChange={(event) => edit({ returnParam: event.target.value })}
          placeholder="callbackUrl"
          spellCheck={false}
          autoComplete="off"
        />
        <FieldError id={`${id}-param-error`} message={paramError} />
      </label>
      {formError ? (
        <p role="alert" className="text-warning text-[13px]/5 leading-snug">
          {formError}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <SaveButton disabled={!canSave}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</SaveButton>
        {dirty && !saving ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={BUTTON_TEXT}
            onClick={() => {
              setDraft(stored);
              setProblem(null);
            }}
          >
            Vazgeç
          </Button>
        ) : null}
        {saved && !dirty ? (
          <span role="status" className="text-success text-[13px]/5">
            Kaydedildi
          </span>
        ) : null}
      </div>
    </form>
  );
}
