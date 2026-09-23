'use client';

import { useId, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StatusChip } from '@/components/chrome/StatusChip';
import { SwitchTrack } from '@/components/chrome/Switch';
import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';
import { listStatus } from '@/lib/list-status';
import {
  handoffTargetErrors,
  ROOT_URL_OUTSIDE_DOMAIN,
  rootUrlAllowsHandoff,
  type HandoffTarget,
  type HandoffTargetInput,
} from '@/lib/handoff/targets';

const COLUMN_LABEL = 'text-3xs font-medium uppercase tracking-[0.18em] text-neutral-600';

function targetTitle(target: HandoffTarget): string {
  const name = target.name?.trim();
  // Keycloak's built-in clients carry message keys such as `${client_admin-cli}` as names.
  return name && !name.startsWith('${') ? name : target.clientId;
}

function HandoffSwitch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-visible:ring-skylab-400/40 rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SwitchTrack checked={checked} />
    </button>
  );
}

type FieldName = 'signInPath' | 'returnParam';
type SaveProblem = { detail: string; field?: FieldName };

function trimmed(input: HandoffTargetInput): HandoffTargetInput {
  return { ...input, signInPath: input.signInPath.trim(), returnParam: input.returnParam.trim() };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-3xs mt-1 leading-snug text-red-300">
      {message}
    </p>
  ) : null;
}

function storedInput(target: HandoffTarget): HandoffTargetInput {
  return {
    enabled: target.enabled === true,
    signInPath: target.signInPath ?? '',
    returnParam: target.returnParam ?? '',
  };
}

type RowEvents = {
  onSaved: (target: HandoffTarget) => void;
  /** Keycloak refused the admin (403): the page hides the settings. */
  onForbidden: () => void;
};

function HandoffTargetRow({ target, onSaved, onForbidden }: { target: HandoffTarget } & RowEvents) {
  const title = targetTitle(target);
  const id = useId();
  const formId = `${id}-form`;
  const [draft, setDraft] = useState<HandoffTargetInput>(() => storedInput(target));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const stored = storedInput(target);
  const dirty =
    draft.enabled !== stored.enabled ||
    draft.signInPath !== stored.signInPath ||
    draft.returnParam !== stored.returnParam;
  const errors = dirty ? handoffTargetErrors(trimmed(draft), target.rootUrl) : {};
  const originAllowed = rootUrlAllowsHandoff(target.rootUrl);
  const canSave = dirty && !saving && !errors.signInPath && !errors.returnParam && !errors.target;
  const fieldError = (field: FieldName) =>
    errors[field] ?? (problem?.field === field ? problem.detail : undefined);
  const rowError = (problem && !problem.field ? problem.detail : undefined) ?? errors.target;

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
    <tr className="align-top">
      <td className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-200">{title}</span>
          <StatusChip
            kind={target.enabled ? 'active' : 'neutral'}
            label={target.enabled ? 'Açık' : 'Kapalı'}
          />
        </div>
        <p className="text-3xs mt-0.5 truncate text-neutral-500">
          {target.clientId} · {target.rootUrl || 'kök adres yok'}
        </p>
        {rowError ? (
          <p role="alert" className="text-3xs mt-1 leading-snug text-amber-300">
            {rowError}
          </p>
        ) : !originAllowed ? (
          <p className="text-3xs mt-1 leading-snug text-neutral-500">{ROOT_URL_OUTSIDE_DOMAIN}</p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <HandoffSwitch
          checked={draft.enabled}
          label={`${title} için SkyApp'ten geçiş`}
          disabled={saving || (!draft.enabled && !originAllowed)}
          onChange={(enabled) => edit({ enabled })}
        />
      </td>
      <td className="px-3 py-3">
        <Field
          form={formId}
          aria-label={`Giriş kapısı yolu (${target.clientId})`}
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
      </td>
      <td className="px-3 py-3">
        <Field
          form={formId}
          aria-label={`Dönüş parametresi (${target.clientId})`}
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
      </td>
      <td className="px-3 py-3">
        <form
          id={formId}
          className="flex flex-col items-end gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-1">
            {dirty && !saving ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(stored);
                  setProblem(null);
                }}
                className="text-2xs h-8 rounded-md px-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
              >
                Vazgeç
              </button>
            ) : null}
            <SaveButton disabled={!canSave}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</SaveButton>
          </div>
          {saved && !dirty ? <span className="text-3xs text-emerald-300">Kaydedildi</span> : null}
        </form>
      </td>
    </tr>
  );
}

export function HandoffTargetsTable({
  loading,
  targets,
  onSaved,
  onForbidden,
}: {
  loading: boolean;
  targets: readonly HandoffTarget[];
} & RowEvents) {
  return (
    <ListPanel
      status={listStatus({
        loading,
        rowCount: targets.length,
        emptyMessage: "Keycloak'ta istemci yok.",
      })}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className={`${COLUMN_LABEL} px-3 py-2 text-left`}>
                Site
              </th>
              <th scope="col" className={`${COLUMN_LABEL} w-20 px-3 py-2 text-left`}>
                Geçiş
              </th>
              <th scope="col" className={`${COLUMN_LABEL} w-52 px-3 py-2 text-left`}>
                Giriş kapısı yolu
              </th>
              <th scope="col" className={`${COLUMN_LABEL} w-44 px-3 py-2 text-left`}>
                Dönüş parametresi
              </th>
              <th scope="col" className="w-36 px-3 py-2">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {targets.map((target) => (
              <HandoffTargetRow
                key={target.clientId}
                target={target}
                onSaved={onSaved}
                onForbidden={onForbidden}
              />
            ))}
          </tbody>
        </table>
      </div>
    </ListPanel>
  );
}
