import { ProblemError } from '@/lib/api/core';
import type {
  FormMapping,
  FormQuestion,
  RespondentTicketPreview,
  RespondentTicketResult,
} from '@/lib/api/form-respondents';
import { coreProblemMessage } from '@/lib/core-problems';

export type MappingField = keyof FormMapping;

/** The guest's name and e-mail boxes, in the order the panel shows them. */
export const MAPPING_FIELDS: { field: MappingField; label: string }[] = [
  { field: 'firstName', label: 'Ad' },
  { field: 'lastName', label: 'Soyad' },
  { field: 'fullName', label: 'Ad soyad' },
  { field: 'email', label: 'E-posta' },
];

/** The optional details' boxes (core docs/form-mappings.md "The details"), after the name's. */
export const DETAIL_FIELDS: { field: MappingField; label: string }[] = [
  { field: 'phone', label: 'Telefon' },
  { field: 'university', label: 'Üniversite' },
  { field: 'department', label: 'Bölüm' },
  { field: 'grade', label: 'Sınıf' },
];

const ALL_FIELDS = [...MAPPING_FIELDS, ...DETAIL_FIELDS];
const DETAILS = new Set<MappingField>(DETAIL_FIELDS.map(({ field }) => field));

/** Whether the box is one of the optional details'. */
export function isDetailField(field: MappingField): boolean {
  return DETAILS.has(field);
}

export const EMPTY_MAPPING: FormMapping = {
  firstName: null,
  lastName: null,
  fullName: null,
  email: null,
  phone: null,
  university: null,
  department: null,
  grade: null,
};

/** A mapping as core answers it, the details an older core leaves out as none. */
export function mappingOf(saved: Partial<FormMapping>): FormMapping {
  const out: FormMapping = { ...EMPTY_MAPPING };
  for (const { field } of ALL_FIELDS) out[field] = saved[field] ?? null;
  return out;
}

/** Whether a mapping names any detail's question. */
export function hasDetails(mapping: FormMapping): boolean {
  return DETAIL_FIELDS.some(({ field }) => Boolean(mapping[field]));
}

/** Lower case the Turkish way, accents dropped, punctuation to spaces. */
export function foldQuestion(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Okul", "okulunuz", "hangi okulda": the school a guest studies at. */
const SCHOOL = /\bokul(u|un|unuz|da|dasin|dasiniz)?\b/;
/** A school's number, club or community is not the school. */
const NOT_SCHOOL = /numara|\bno\b|kulub|kulup|topluluk/;
/** "Bölüm", "bölümünüz", "hangi bölümde": the department a guest studies in. */
const STUDY_DEPARTMENT = /\bbolum(u|un|unuz|de|unde|undesin|undesiniz)?\b/;
/** A part of the Event (a session's, the program's) is not a department. */
const NOT_DEPARTMENT = /oturum|etkinli|program|kisim|katil/;

/** Which box a question's text points to (SPEC §5.2 step 3), or null. */
export function fieldFromText(text: string): MappingField | null {
  const t = foldQuestion(text);
  if (!t) return null;
  if (/e-?posta|mail/.test(t)) return 'email';
  if (/telefon|\bgsm\b|\bcep\b|phone/.test(t)) return 'phone';
  if (/universite|university/.test(t) || (SCHOOL.test(t) && !NOT_SCHOOL.test(t))) {
    return 'university';
  }
  if (/department/.test(t) || (STUDY_DEPARTMENT.test(t) && !NOT_DEPARTMENT.test(t))) {
    return 'department';
  }
  if (/\bsinif|\bkacinci|\bgrade\b|year of study/.test(t)) return 'grade';
  if (/\b(ad|adi|adiniz) (ve )?(soyad|soyadi|soyadiniz)\b|\bad-soyad|isim soyisim/.test(t)) {
    return 'fullName';
  }
  if (/soyad|soyisim/.test(t)) return 'lastName';
  if (/^(ad|adi)$|^adiniz|^isim|^ismin/.test(t)) return 'firstName';
  return null;
}

const IDENTITY: Record<string, MappingField> = {
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
};

const INPUT_TYPE: Record<string, MappingField> = {
  email: 'email',
  name: 'fullName',
  tel: 'phone',
  phone: 'phone',
};

/**
 * The panel's guess (SPEC §5.2): core's `suggestion` (the identity fields), then Forms' identity
 * mark, then `inputType`, then the question's text. A box gets a question only when exactly one
 * free question fits it; a question fills one box. `guessed` lists the boxes filled here.
 *
 * With `saved` (a mapping kept already), the guess starts from it and fills only the details'
 * empty boxes, with questions it does not name: the name's boxes stay as saved.
 */
export function guessMapping(
  questions: FormQuestion[],
  suggestion: Partial<FormMapping> = {},
  saved?: FormMapping,
): { mapping: FormMapping; guessed: MappingField[] } {
  const ids = new Set(questions.map((q) => q.id));
  const mapping: FormMapping = saved ? { ...saved } : { ...EMPTY_MAPPING };
  const used = new Set<string>(Object.values(mapping).filter((id): id is string => Boolean(id)));
  const guessed: MappingField[] = [];
  const open = (field: MappingField) => !mapping[field] && (!saved || isDetailField(field));
  const take = (field: MappingField, id: string) => {
    mapping[field] = id;
    used.add(id);
    guessed.push(field);
  };
  for (const { field } of ALL_FIELDS) {
    const id = suggestion[field];
    if (id && ids.has(id) && !used.has(id) && open(field)) take(field, id);
  }
  const steps: ((q: FormQuestion) => MappingField | null)[] = [
    (q) => (q.identity ? (IDENTITY[q.identity] ?? null) : null),
    (q) => (q.inputType ? (INPUT_TYPE[q.inputType] ?? null) : null),
    (q) => fieldFromText(q.question),
  ];
  for (const step of steps) {
    const fits = new Map<MappingField, string[]>();
    for (const q of questions) {
      if (used.has(q.id)) continue;
      const field = step(q);
      if (!field || !open(field) || !questionFits(field, q)) continue;
      fits.set(field, [...(fits.get(field) ?? []), q.id]);
    }
    for (const [field, found] of fits) {
      if (found.length === 1) take(field, found[0]!);
    }
  }
  return { mapping, guessed };
}

/** Why the mapping cannot be saved (core's rule), or null. */
export function mappingIssue(mapping: FormMapping): string | null {
  if (!mapping.email) return 'E-posta sorusunu seç.';
  if (!mapping.fullName && !(mapping.firstName && mapping.lastName)) {
    return 'Ad ve soyad ya da ad soyad sorusunu seç.';
  }
  const chosen = Object.values(mapping).filter(Boolean);
  if (new Set(chosen).size !== chosen.length) return 'Bir soru iki kutuda seçili.';
  return null;
}

/** Forms question types that cannot hold a name or an address: the boxes leave them out. */
const NOT_TEXT = new Set([
  'file',
  'matrix',
  'repeater',
  'toggle',
  'slider',
  'date',
  'time',
  'multi_choice',
]);

/**
 * Forms question types no detail reads from. A choice question may hold a university, a
 * department or a grade: Forms keeps its answer as the option's text.
 */
const NOT_DETAIL = new Set(['file', 'matrix', 'repeater', 'toggle', 'date', 'time']);

/** Whether a question may hold a name or an e-mail. */
export function mappableQuestion(q: FormQuestion): boolean {
  return !NOT_TEXT.has(q.type);
}

/** Whether the box may take the question: a name's or e-mail's a text, a detail's a choice too. */
export function questionFits(field: MappingField, q: FormQuestion): boolean {
  return isDetailField(field) ? !NOT_DETAIL.has(q.type) : mappableQuestion(q);
}

/** The mapping, questions and send routes' refusals in the panel's words. */
export function formMappingProblem(err: unknown, fallback: string): string {
  if (err instanceof ProblemError) {
    switch (err.code) {
      case 'forms_pull_off':
        return 'Forms bağlantısı kapalı.';
      case 'forms_access_denied':
        return 'Bu forma erişimin yok.';
      case 'mapping_question_missing':
        return 'Seçili bir soru artık formda yok.';
      case 'mapping_invalid':
        return 'Eşleme geçersiz: e-posta ile ad ve soyad ya da ad soyad gerekli.';
      case 'mapping_too_many_questions':
        return 'Bu formun eşlemeleri birlikte en çok 20 soru seçebilir.';
      case 'form_not_listed':
        return 'Etkinliği kaydet, sonra eşle.';
      case 'form_not_found':
        return 'Form Forms’ta bulunamadı.';
      case 'forms_unavailable':
        return 'Forms yanıt vermedi. Biraz sonra dene.';
      case 'event_cancelled':
        return 'Etkinlik iptal edildi; bilet yazılmaz.';
      case 'event_ended':
        return 'Etkinlik bitti; bilet yazılmaz.';
      case 'ticket_job_not_found':
        return 'Gönderim bulunamadı.';
    }
  }
  return coreProblemMessage(err, fallback);
}

/** "3 bilet, 1 bekleme listesi, 2 yer yok": the parts that are not zero. */
export function previewLine(p: Partial<RespondentTicketPreview & RespondentTicketResult>): string {
  const parts: string[] = [];
  const tickets = (p.tickets ?? 0) + (p.recorded ?? 0);
  parts.push(`${tickets} bilet`);
  if (p.waitlisted) parts.push(`${p.waitlisted} bekleme listesi`);
  if (p.full) parts.push(`${p.full} yer yok`);
  if (p.alreadyTicketed) parts.push(`${p.alreadyTicketed} zaten biletli`);
  if (p.skipped) parts.push(`${p.skipped} atlandı`);
  return parts.join(', ');
}
