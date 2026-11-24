'use client';

import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useMemo, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { SidePanel } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { Switch } from '@/components/chrome/Switch';
import {
  certificatesApi,
  type CertificateRule,
  type CertificateRuleBody,
  type CertificateRuleSession,
} from '@/lib/api/certificates';
import type { EventDay } from '@/lib/api/eventDays';
import { sessionTypeLabel } from '@/lib/api/sessions';
import {
  countedTotal,
  defaultMin,
  minFromRatio,
  percentOf,
  ruleIssues,
  withMark,
  type SessionMarks,
  type WritableRule,
} from '@/lib/certificate-rule';
import { coreProblemMessage } from '@/lib/core-problems';
import { sessionClock } from '@/lib/event-overview';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

const CHECKBOX = 'accent-skylab-400 size-4 shrink-0 disabled:opacity-40';

type Draft = {
  rule: WritableRule;
  /** null: the default ⌈3N/4⌉. */
  minCount: number | null;
  /** What the threshold box holds while typed. */
  minText: string;
  marks: Record<string, SessionMarks>;
  autoFinalize?: boolean;
};

/**
 * The editor's starting point: the stored rule, or for an older `ratio` rule
 * the `count` rule it stands for (⌈ratio × N⌉), to be written on save.
 */
export function draftFromRule(rule: CertificateRule): Draft {
  const marks = Object.fromEntries(
    rule.sessions.map((s) => [s.id, { counted: s.counted, required: s.required }]),
  );
  const n = countedTotal(rule.sessions);
  const minCount =
    rule.rule === 'ratio'
      ? minFromRatio(rule.ratio ?? 0.75, n)
      : rule.rule === 'count'
        ? rule.minCount
        : null;
  return {
    rule: rule.rule === 'ratio' ? 'count' : rule.rule,
    minCount,
    minText: String(minCount ?? defaultMin(n)),
    marks,
    autoFinalize: rule.autoFinalize,
  };
}

/** The PUT for a draft: the rule, the threshold and only the Sessions whose marks changed. */
export function ruleBodyFromDraft(rule: CertificateRule, draft: Draft): CertificateRuleBody {
  const sessions = rule.sessions
    .filter((s) => {
      const mark = draft.marks[s.id];
      return mark && (mark.counted !== s.counted || mark.required !== s.required);
    })
    .map((s) => ({ id: s.id, ...draft.marks[s.id] }));
  return {
    rule: draft.rule,
    minCount: draft.rule === 'count' ? draft.minCount : null,
    sessions,
    // Sent only once core answers it (ticket 03): an older answer leaves it out
    ...(typeof rule.autoFinalize === 'boolean' ? { autoFinalize: draft.autoFinalize } : {}),
  };
}

/** The Sessions by day, in program order. */
function byDay(sessions: readonly CertificateRuleSession[]) {
  const groups: { dayId: string; sessions: CertificateRuleSession[] }[] = [];
  for (const session of sessions) {
    const last = groups[groups.length - 1];
    if (last?.dayId === session.dayId) last.sessions.push(session);
    else groups.push({ dayId: session.dayId, sessions: [session] });
  }
  return groups;
}

export function CertificateRuleSheet({
  open,
  rule,
  eventId,
  days,
  finalized,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: CertificateRule;
  eventId: string;
  days: readonly EventDay[];
  /** Attendance was closed: a change moves only the list and a rescan. */
  finalized: boolean;
  onClose: () => void;
  onSaved: (rule: CertificateRule) => void;
}) {
  const initial = useMemo(() => draftFromRule(rule), [rule]);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // Each opening starts from what core has
  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setError(undefined);
  }, [open, initial]);

  const sessions = rule.sessions.map((s) => ({ ...s, ...(draft.marks[s.id] ?? s) }));
  const n = countedTotal(sessions);
  const shownMin = draft.minCount ?? defaultMin(n);
  const issues = ruleIssues({ rule: draft.rule, minCount: draft.minCount, sessions });
  const body = ruleBodyFromDraft(rule, draft);
  const dirty =
    rule.rule !== draft.rule ||
    (draft.rule === 'count' && rule.minCount !== draft.minCount) ||
    body.sessions.length > 0 ||
    (typeof rule.autoFinalize === 'boolean' && rule.autoFinalize !== draft.autoFinalize);
  const dayName = new Map(days.map((day) => [day.id, day.name]));

  const setMark = (id: string, box: 'counted' | 'required', value: boolean) =>
    setDraft((d) => ({ ...d, marks: { ...d.marks, [id]: withMark(d.marks[id], box, value) } }));

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      onSaved(await certificatesApi.setRule(eventId, body));
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Kural kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel open={open} title="Sertifika kuralı" onClose={onClose} dirty={dirty && !saving}>
      {finalized ? (
        <p role="status" className="text-warning text-[13px]/5">
          Katılım kapandı; değişiklik yalnız yeniden taramayı ve listeyi etkiler.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-[13px]/5">
          {error}
        </p>
      ) : null}
      <label className="block space-y-1">
        <FieldLabel>Kural</FieldLabel>
        <Select
          value={draft.rule}
          onChange={(e) => setDraft((d) => ({ ...d, rule: e.target.value as WritableRule }))}
        >
          <option value="none">Yok</option>
          <option value="once">En az bir oturum</option>
          <option value="count">Oturum sayısı</option>
        </Select>
      </label>
      {rule.rule === 'ratio' ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          Eski kural: %{Math.round((rule.ratio ?? 0) * 100)} oran. Kaydedince oturum sayısına geçer.
        </p>
      ) : null}

      {draft.rule === 'count' ? (
        <div className="space-y-1">
          <div className="text-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>
              Toplam <strong className="font-semibold tabular-nums">{n}</strong> oturum · en az
            </span>
            <Field
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, n)}
              step={1}
              disabled={n === 0}
              aria-label="En az kaç oturum"
              aria-invalid={Boolean(issues.minCount)}
              className="w-16 tabular-nums"
              value={draft.minCount === null ? String(shownMin) : draft.minText}
              onChange={(e) => {
                const text = e.target.value;
                setDraft((d) => ({
                  ...d,
                  minText: text,
                  minCount: text.trim() === '' ? Number.NaN : Number(text),
                }));
              }}
            />
            <span className="text-secondary-foreground tabular-nums">
              {Number.isFinite(shownMin) && n > 0 ? `(%${percentOf(shownMin, n)})` : ''}
            </span>
            {draft.minCount !== null ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={BUTTON_TEXT}
                onClick={() =>
                  setDraft((d) => ({ ...d, minCount: null, minText: String(defaultMin(n)) }))
                }
              >
                Varsayılan (%75)
              </Button>
            ) : (
              <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Varsayılan</span>
            )}
          </div>
          {issues.minCount ? (
            <p role="alert" className="text-destructive text-[13px]/5">
              {issues.minCount}
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.rule !== 'none' ? (
        <section aria-label="Oturumlar" className="space-y-2">
          {issues.sessions ? (
            <p role="alert" className="text-destructive text-[13px]/5">
              {issues.sessions}
            </p>
          ) : null}
          {rule.sessions.length === 0 ? (
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Programda oturum yok</p>
          ) : (
            <div className="border-border-subtle rounded-md border">
              <div
                className={`text-subtle-foreground grid grid-cols-[minmax(0,1fr)_3.75rem_3.75rem] items-center gap-2 px-3 py-2 ${TEXT_SECONDARY}`}
              >
                <span>Oturum</span>
                <span className="text-center">Sayılır</span>
                <span className="text-center">Zorunlu</span>
              </div>
              {byDay(sessions).map((group) => (
                <div key={group.dayId} className="border-border-subtle border-t">
                  <p
                    className={`text-secondary-foreground bg-muted/40 px-3 py-1.5 font-medium ${TEXT_SECONDARY}`}
                  >
                    {dayName.get(group.dayId) ?? 'Gün'}
                  </p>
                  <ul className="divide-border-subtle divide-y">
                    {group.sessions.map((session) => (
                      <li
                        key={session.id}
                        className={cn(
                          'grid grid-cols-[minmax(0,1fr)_3.75rem_3.75rem] items-center gap-2 px-3 py-2',
                          session.cancelled && 'opacity-50',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'text-foreground truncate text-sm',
                                session.cancelled && 'line-through',
                              )}
                            >
                              {session.title}
                            </span>
                            {session.cancelled ? (
                              <StatusChip kind="cancelled" label="İptal" />
                            ) : null}
                          </span>
                          <span
                            className={`text-subtle-foreground block truncate ${TEXT_SECONDARY}`}
                          >
                            {[sessionClock(session), sessionTypeLabel(session.sessionType)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="flex justify-center">
                          <input
                            type="checkbox"
                            className={CHECKBOX}
                            aria-label={`${session.title}: sayılır`}
                            title={session.required ? 'Zorunlu oturum sayılır' : undefined}
                            checked={session.counted}
                            disabled={session.cancelled || session.required}
                            onChange={(e) => setMark(session.id, 'counted', e.target.checked)}
                          />
                        </span>
                        <span className="flex justify-center">
                          <input
                            type="checkbox"
                            className={CHECKBOX}
                            aria-label={`${session.title}: zorunlu`}
                            checked={session.required}
                            disabled={session.cancelled}
                            onChange={(e) => setMark(session.id, 'required', e.target.checked)}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {typeof rule.autoFinalize === 'boolean' && draft.rule !== 'none' ? (
        <Switch
          checked={Boolean(draft.autoFinalize)}
          onChange={(checked) => setDraft((d) => ({ ...d, autoFinalize: checked }))}
          label="Katılımı kendiliğinden kapat"
          hint="Son oturumdan 1 saat sonra"
        />
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <SaveButton
          type="button"
          disabled={saving || !dirty || Boolean(issues.minCount || issues.sessions)}
          onClick={() => void save()}
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </SaveButton>
        <Button type="button" variant="ghost" className={BUTTON_TEXT} onClick={onClose}>
          Vazgeç
        </Button>
      </div>
    </SidePanel>
  );
}
