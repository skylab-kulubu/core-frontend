'use client';

import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { CheckCircle2, CircleAlert, UserPlus } from 'lucide-react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Select } from '@/components/chrome/Select';
import { ProblemError } from '@/lib/api/core';
import {
  ticketsApi,
  type EntryMode,
  type WalkInBody,
  type WalkInGrade,
  type WalkInResult,
} from '@/lib/api/tickets';
import { coreProblemMessage } from '@/lib/core-problems';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

type Values = Required<WalkInBody>;
type FieldName = keyof Values;

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  university: '',
  department: '',
  grade: '',
};
const ORDER: FieldName[] = ['firstName', 'lastName', 'email'];

/** A rough shape only (x@y.z); core checks the address. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A Turkish number of 10 digits, with or without 0 or +90 in front, or an international one
 * from + (7 to 15 digits); spaces, dashes and brackets are let through. Core checks it again.
 */
export function phoneShapeOk(value: string): boolean {
  const digits = value.replace(/[\s\-()]/g, '');
  return /^(?:\+90|0)?[1-9]\d{9}$/.test(digits) || /^\+[1-9]\d{6,14}$/.test(digits);
}

/** Universities offered first; anything else can be typed. */
const UNIVERSITIES = [
  'Yıldız Teknik Üniversitesi',
  'İstanbul Teknik Üniversitesi',
  'Boğaziçi Üniversitesi',
  'İstanbul Üniversitesi',
  'Marmara Üniversitesi',
];

const GRADES: [WalkInGrade, string][] = [
  ['prep', 'Hazırlık'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4'],
  ['masters', 'Yüksek lisans'],
  ['phd', 'Doktora'],
  ['graduate', 'Mezun'],
  ['other', 'Diğer'],
];

const FIELDS_REQUIRED = 'Ad, soyad ve e-posta gerekli.';
const EMAIL_INVALID = 'E-posta geçersiz.';
const PHONE_INVALID = 'Telefon geçersiz.';

/** What the last walk-in came to: written (green), already in today (amber), or refused (red). */
type Shown =
  | { kind: 'done'; title: string; line: string }
  | { kind: 'already' | 'refused'; text: string };

/** The band's two lines for core's answer. */
export function walkInSummary(result: WalkInResult): { title: string; line: string } {
  const created = result.result === 'created';
  const title = created
    ? result.entry
      ? 'Kayıt yapıldı, giriş yazıldı'
      : 'Kayıt yapıldı'
    : result.entry
      ? 'Bileti vardı, giriş yazıldı'
      : 'Bileti var';
  const note = result.ticketMail
    ? 'Bilet postası gönderildi'
    : created
      ? null
      : 'Yeni bilet açılmadı';
  return { title, line: [result.name, result.ticketCode, note].filter(Boolean).join(' · ') };
}

const CLOSED: Record<string, string> = {
  event_not_published: 'Etkinlik henüz yayımlanmadı.',
  event_cancelled: 'Etkinlik iptal edilmiş.',
  event_archived: 'Etkinlik arşivlenmiş.',
  event_ended: 'Etkinlik bitmiş.',
};

/** Core's refusals of a walk-in, in the door's words. */
const REFUSED: Record<string, string> = {
  email_invalid: EMAIL_INVALID,
  phone_invalid: PHONE_INVALID,
  event_full: 'Kontenjan dolu; kapıda kayıt yapılamaz.',
  ticket_waitlisted: 'Bekleme listesinde. Yetkili kişi öne almalı.',
  ticket_cancelled: 'Bileti iptal edilmiş. Yetkili kişiye yönlendir.',
  audit_unavailable: 'Şu an yazılamadı; tekrar dene.',
};

export function walkInRefusal(err: unknown): Extract<Shown, { kind: 'already' | 'refused' }> {
  if (err instanceof ProblemError) {
    if (err.code === 'already_entered') {
      const name = typeof err.fields.name === 'string' ? err.fields.name : '';
      return { kind: 'already', text: name ? `${name} bugün zaten girdi.` : 'Bugün zaten girmiş.' };
    }
    if (err.code === 'event_closed') {
      const reason = typeof err.fields.reason === 'string' ? err.fields.reason : '';
      return { kind: 'refused', text: CLOSED[reason] ?? 'Etkinlik girişe kapalı.' };
    }
    if (err.code && REFUSED[err.code]) return { kind: 'refused', text: REFUSED[err.code] };
    if (!err.code && err.status === 403) {
      return { kind: 'refused', text: 'Bu etkinlikte kapıda kayıt yetkin yok.' };
    }
    if (!err.code && err.status === 404) return { kind: 'refused', text: 'Etkinlik bulunamadı.' };
  }
  return { kind: 'refused', text: coreProblemMessage(err, 'Kayıt yazılamadı') };
}

/** The fields core named in `guest_fields_required`. */
function missingOf(err: unknown): FieldName[] {
  if (!(err instanceof ProblemError) || err.code !== 'guest_fields_required') return [];
  const named = Array.isArray(err.fields.fields) ? err.fields.fields : [];
  return ORDER.filter((name) => named.includes(name));
}

/**
 * Kapıda kayıt: a person who arrives without a ticket gets one at the door (first name, last
 * name, e-mail; nothing else is asked). Core writes the ticket and, on an event run with one
 * entry a day, the day's venue entry; a person who already holds one keeps it.
 */
export function DoorWalkIn({
  eventId,
  entryMode,
  onDone,
}: {
  eventId: string;
  /** The event's effective entry mode: `venue` also lets the person in. */
  entryMode?: EntryMode;
  /** After core wrote something, so the door's count and list catch up. */
  onDone?: (result: WalkInResult) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(EMPTY);
  // Ek bilgiler comes open; closed once, it stays closed for the next person
  const [extras, setExtras] = useState(true);
  const [invalid, setInvalid] = useState<FieldName[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);

  const fieldId = (name: FieldName) => `${id}-${name}`;
  const focusField = (name: FieldName) => document.getElementById(fieldId(name))?.focus();

  useEffect(() => {
    if (open) document.getElementById(`${id}-firstName`)?.focus();
  }, [open, id]);

  function openForm() {
    setShown(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setValues(EMPTY);
    setInvalid([]);
    setProblem(null);
  }

  function setField(name: FieldName, value: string) {
    setValues((now) => ({ ...now, [name]: value }));
    if (invalid.includes(name)) setInvalid((now) => now.filter((row) => row !== name));
  }

  /** Enter on a name goes to the next field, not to core. */
  function next(event: KeyboardEvent<HTMLInputElement>, name: FieldName) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    focusField(name);
  }

  function refuse(names: FieldName[], text: string) {
    if (names.includes('phone')) setExtras(true);
    setInvalid(names);
    setProblem(text);
    if (names[0]) focusField(names[0]);
  }

  async function submit(form: FormEvent) {
    form.preventDefault();
    if (busy) return;
    const body: WalkInBody = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      university: values.university.trim(),
      department: values.department.trim(),
      grade: values.grade,
    };
    const missing = ORDER.filter((name) => !body[name]);
    if (missing.length) {
      refuse(missing, FIELDS_REQUIRED);
      return;
    }
    if (!EMAIL.test(body.email)) {
      refuse(['email'], EMAIL_INVALID);
      return;
    }
    if (body.phone && !phoneShapeOk(body.phone)) {
      refuse(['phone'], PHONE_INVALID);
      return;
    }
    setInvalid([]);
    setProblem(null);
    setShown(null);
    setBusy(true);
    try {
      const result = await ticketsApi.walkIn(eventId, body);
      close();
      setShown({ kind: 'done', ...walkInSummary(result) });
      document.getElementById(`${id}-toggle`)?.focus();
      onDone?.(result);
    } catch (err) {
      const named = missingOf(err);
      if (named.length) refuse(named, FIELDS_REQUIRED);
      else if (err instanceof ProblemError && err.code === 'email_invalid') {
        refuse(['email'], EMAIL_INVALID);
      } else if (err instanceof ProblemError && err.code === 'phone_invalid') {
        refuse(['phone'], PHONE_INVALID);
      } else setShown(walkInRefusal(err));
    } finally {
      setBusy(false);
    }
  }

  const venue = entryMode === 'venue';
  const formId = `${id}-form`;
  const problemId = `${id}-problem`;
  const field = (
    name: Exclude<FieldName, 'grade'>,
    label: string,
    props: Partial<Parameters<typeof Field>[0]>,
    then?: FieldName,
    /** The whole row at phone width; one of two columns from `sm` up. */
    wide = false,
  ) => (
    <div className={cn('min-w-0 space-y-1', wide && 'col-span-2 sm:col-span-1')}>
      <label htmlFor={fieldId(name)} className="block">
        <FieldLabel>{label}</FieldLabel>
      </label>
      <Field
        id={fieldId(name)}
        name={name}
        autoComplete="off"
        value={values[name]}
        onChange={(change) => setField(name, change.target.value)}
        onKeyDown={then ? (event) => next(event, then) : undefined}
        aria-invalid={invalid.includes(name) || undefined}
        aria-describedby={invalid.includes(name) && problem ? problemId : undefined}
        disabled={busy}
        className="h-11 text-base"
        {...props}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <Button
        id={`${id}-toggle`}
        type="button"
        variant="outline"
        size="lg"
        className={cn(BUTTON_TEXT, 'w-full')}
        aria-expanded={open}
        aria-controls={open ? formId : undefined}
        onClick={() => (open ? close() : openForm())}
      >
        <UserPlus aria-hidden />
        Kapıda kayıt
      </Button>

      {open ? (
        <form
          id={formId}
          aria-label="Kapıda kayıt"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="border-border-subtle bg-card space-y-3 rounded-xl border p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {field(
              'firstName',
              'Ad',
              { autoCapitalize: 'words', enterKeyHint: 'next', spellCheck: false },
              'lastName',
            )}
            {field(
              'lastName',
              'Soyad',
              { autoCapitalize: 'words', enterKeyHint: 'next', spellCheck: false },
              'email',
            )}
          </div>
          {field('email', 'E-posta', {
            type: 'email',
            inputMode: 'email',
            autoCapitalize: 'none',
            enterKeyHint: 'done',
            spellCheck: false,
          })}
          <details
            open={extras}
            onToggle={(event) => setExtras(event.currentTarget.open)}
            className="border-border-subtle rounded-lg border"
          >
            <summary
              className={cn(
                'text-foreground flex min-h-11 cursor-pointer items-center px-3 font-medium select-none',
                TEXT_SECONDARY,
              )}
            >
              Ek bilgiler
            </summary>
            <div className="grid grid-cols-2 gap-3 px-3 pb-3">
              {field(
                'phone',
                'Telefon (isteğe bağlı)',
                {
                  type: 'tel',
                  inputMode: 'tel',
                  autoComplete: 'tel',
                  enterKeyHint: 'next',
                  placeholder: '0 5xx xxx xx xx',
                },
                'university',
                true,
              )}
              {field(
                'university',
                'Üniversite (isteğe bağlı)',
                { list: `${id}-universities` },
                undefined,
                true,
              )}
              <datalist id={`${id}-universities`}>
                {UNIVERSITIES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {field(
                'department',
                'Bölüm (isteğe bağlı)',
                {
                  autoCapitalize: 'words',
                  enterKeyHint: 'next',
                },
                'grade',
              )}
              <div className="min-w-0 space-y-1">
                <label htmlFor={fieldId('grade')} className="block">
                  <FieldLabel>Sınıf (isteğe bağlı)</FieldLabel>
                </label>
                <Select
                  id={fieldId('grade')}
                  name="grade"
                  value={values.grade}
                  onChange={(change) => setField('grade', change.target.value)}
                  disabled={busy}
                  className="h-11"
                >
                  <option value="">Seçilmedi</option>
                  {GRADES.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </details>
          {problem ? (
            <p id={problemId} role="alert" className="text-destructive text-sm">
              {problem}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className={cn(BUTTON_TEXT, 'min-w-0 flex-1')}
              disabled={busy}
            >
              <UserPlus aria-hidden />
              {busy ? 'Yazılıyor…' : venue ? 'Kaydet ve içeri al' : 'Kaydet'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={BUTTON_TEXT}
              disabled={busy}
              onClick={close}
            >
              Vazgeç
            </Button>
          </div>
        </form>
      ) : null}

      {/* Always mounted, so each new line is read out */}
      <div role="status" aria-label="Kapıda kayıt sonucu" aria-live="polite">
        {shown ? (
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl border p-4',
              shown.kind === 'done' && 'border-success/50 bg-success/15',
              shown.kind === 'already' && 'border-warning/50 bg-warning/15',
              shown.kind === 'refused' && 'border-destructive/50 bg-destructive/15',
            )}
          >
            {shown.kind === 'done' ? (
              <CheckCircle2 className="text-success size-8 shrink-0" aria-hidden />
            ) : (
              <CircleAlert
                className={cn(
                  'size-8 shrink-0',
                  shown.kind === 'already' ? 'text-warning' : 'text-destructive',
                )}
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-foreground-strong text-lg leading-tight font-semibold">
                {shown.kind === 'done'
                  ? shown.title
                  : shown.kind === 'already'
                    ? 'Zaten girmiş'
                    : 'Kayıt yazılmadı'}
              </p>
              <p className={cn('text-secondary-foreground break-words', TEXT_SECONDARY)}>
                {shown.kind === 'done' ? shown.line : shown.text}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
