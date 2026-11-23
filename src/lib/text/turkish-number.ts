// The possessive ending a number takes when read aloud, from how its last word sounds:
// "%50'si" (elli), "%75'i" (yetmiş beş), "%100'ü" (yüz), "%40'ı" (kırk), "%90'ı" (doksan)
const ONES = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'] as const;
const TENS = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'] as const;

/** The third-person possessive ending of a whole number, without the apostrophe: 50 → "si". */
export function possessiveEnding(value: number): string {
  const n = Math.abs(Math.trunc(value));
  if (n === 0) return 'ı';
  if (n % 10) return ONES[n % 10];
  if (n % 100) return TENS[(n % 100) / 10];
  if (n % 1000) return 'ü';
  if (n % 1_000_000) return 'i';
  return 'u';
}

/** A percentage with its possessive ending, as in "kayıtların %50'si": 50 → "%50'si". */
export function percentWithEnding(value: number): string {
  const n = Math.round(value);
  return `%${n}'${possessiveEnding(n)}`;
}
