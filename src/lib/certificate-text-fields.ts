import type { CertificateElementKind } from '@/lib/api/certificates';

/** The kinds a PDF text can turn into (core `text-conversion` `kinds`). */
export type TextFieldKind = Extract<
  CertificateElementKind,
  'recipientName' | 'eventName' | 'eventDates' | 'issueDate'
>;

/**
 * Placeholders a designer leaves in a PDF for a certificate's own value, read
 * after the brackets around them ([İsim], {ad}, {{…}}, <<…>>) are taken off,
 * in Turkish lower case. The first match wins.
 */
const FIELD_PATTERNS: readonly [RegExp, TextFieldKind][] = [
  [/^etkinlik(\s*ad[ıi])?$/, 'eventName'],
  [/^(etkinlik\s*)?tarih(i)?$/, 'eventDates'],
  [/^(gg|dd)[./-](aa|mm)[./-](yyyy|yy)$/, 'eventDates'],
  [/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/, 'eventDates'],
  [/^kat[ıi]l[ıi]mc[ıi](\s*ad[ıi](\s*soyad[ıi])?)?$/, 'recipientName'],
  [/^ad[ıi]?\s*soyad[ıi]?$/, 'recipientName'],
  [/^isim(\s*soyisim)?$/, 'recipientName'],
  [/^(full\s*)?name$/, 'recipientName'],
  [/^x{3,}$/, 'recipientName'],
];

/** Words that are a placeholder only inside brackets ("Ad" alone may be a label). */
const BRACKETED_ONLY: readonly [RegExp, TextFieldKind][] = [
  [/^(ad|ad_soyad|adsoyad|isim_soyisim|katilimci|katilimci_adi)$/, 'recipientName'],
];

const BRACKETS = [
  ['{{', '}}'],
  ['[', ']'],
  ['{', '}'],
  ['<<', '>>'],
  ['«', '»'],
] as const;

/**
 * The certificate value a PDF text stands for, as the editor offers it in the
 * conversion list ("Ad Soyad" → Katılımcı adı); undefined for ordinary text.
 * A `{{…}}` placeholder that names nothing else is the recipient's name.
 */
export function suggestTextField(text: string): TextFieldKind | undefined {
  let value = text.normalize('NFC').trim();
  let bracket: (typeof BRACKETS)[number] | undefined;
  for (const pair of BRACKETS) {
    if (
      value.length > pair[0].length + pair[1].length &&
      value.startsWith(pair[0]) &&
      value.endsWith(pair[1])
    ) {
      bracket = pair;
      value = value.slice(pair[0].length, -pair[1].length).trim();
      break;
    }
  }
  value = value.toLocaleLowerCase('tr').replace(/\s+/g, ' ');
  const plain = FIELD_PATTERNS.find(([pattern]) => pattern.test(value))?.[1];
  if (plain || !bracket) return plain;
  const named = BRACKETED_ONLY.find(([pattern]) => pattern.test(value))?.[1];
  if (named) return named;
  return bracket[0] === '{{' ? 'recipientName' : undefined;
}
