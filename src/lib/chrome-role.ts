const ROLE_MATCHERS: ReadonlyArray<{ test: RegExp; label: string }> = [
  { test: /\/(ADMIN|YK)(\/|$)/i, label: 'YÖNETİM' },
  { test: /\/DK(\/|$)/i, label: 'DENETİM' },
  { test: /WEBLAB/i, label: 'WEBLAB' },
  { test: /SKYSEC/i, label: 'SKYSEC' },
  { test: /MOBILAB/i, label: 'MOBİLAB' },
  { test: /AIRLAB/i, label: 'AIRLAB' },
  { test: /ALGOLAB/i, label: 'ALGOLAB' },
  { test: /GAMELAB/i, label: 'GAMELAB' },
  { test: /CHAINLAB/i, label: 'YAŞIYONUZ MU' },
  { test: /SKYSIS/i, label: 'YAŞIYONUZ MU' },
];

export function clubRoleLabel(groups: readonly string[]): string {
  for (const { test, label } of ROLE_MATCHERS) {
    if (groups.some((path) => test.test(path))) return label;
  }
  return 'KULLANICI';
}

export function displayPersonName(
  firstName?: string,
  lastName?: string,
  username?: string,
): string {
  const raw = `${firstName ?? ''} ${lastName ?? ''}`.trim() || username?.trim() || 'Kullanıcı';
  return raw
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((word) => word.replace(/^\p{L}/u, (ch) => ch.toLocaleUpperCase('tr-TR')))
    .join(' ');
}
