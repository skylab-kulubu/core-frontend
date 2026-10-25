// The third-person possessive after a count, read as it is said: "bir" → 1'i,
// "iki" → 2'si, "üç" → 3'ü. The last word said decides the vowel and whether
// an "s" joins it.
const ONES = ['', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
const TENS = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];

function suffix(count: number): string {
  if (count === 0) return 'ı'; // sıfır
  if (count % 10) return ONES[count % 10]!;
  if (count % 100) return TENS[Math.floor(count / 10) % 10]!;
  if (count % 1000) return 'ü'; // yüz
  if (count % 1_000_000) return 'i'; // bin
  if (count % 1_000_000_000) return 'u'; // milyon
  return 'ı'; // milyar
}

/** "<n> kişiden <k>'i": the count with its possessive suffix, such as 1'i, 2'si, 3'ü. */
export function countPossessive(count: number): string {
  const whole = Math.abs(Math.trunc(count));
  return `${whole}'${suffix(whole)}`;
}
