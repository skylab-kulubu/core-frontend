export const GROUP_TOGGLES = [
  {
    key: 'public_listing',
    label: 'Herkese açık üye listesi',
    hint: 'Site ve takım sayfasında üyeler görünür. Kapalıysa ekip gizlidir.',
  },
  {
    key: 'public_leaders',
    label: 'Yalnız liderler herkese açık',
    hint: 'Üye listesi gizli kalsın, koordinatörler görünsün. Açık liste zaten liderleri gösterir.',
  },
  {
    key: 'team_door_scan',
    label: 'Ekip kapı taraması',
    hint: 'Bu ekibin üyeleri kendi etkinliklerinde check-in yapabilir.',
  },
] as const;

export const GROUP_TEXTS = [
  { key: 'display_name_tr', label: 'Görünen ad (Türkçe)', multiline: false },
  { key: 'display_name_en', label: 'Görünen ad (İngilizce)', multiline: false },
  { key: 'description_tr', label: 'Açıklama (Türkçe)', multiline: true },
  { key: 'description_en', label: 'Açıklama (İngilizce)', multiline: true },
] as const;

const knownKeys = new Set<string>([
  ...GROUP_TOGGLES.map((row) => row.key),
  ...GROUP_TEXTS.map((row) => row.key),
]);

export function isKnownGroupAttr(key: string): boolean {
  return knownKeys.has(key);
}

export function isToggleOn(
  attrs: Record<string, string> | undefined,
  key: string,
): boolean {
  return (attrs?.[key] ?? '').toLowerCase() === 'true';
}

export function extraGroupAttrs(
  attrs: Record<string, string> | undefined,
): Record<string, string> {
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (!knownKeys.has(key)) extra[key] = value;
  }
  return extra;
}

export function buildGroupAttrs(opts: {
  toggles: Record<string, boolean>;
  texts: Record<string, string>;
  extra: Record<string, string>;
}): Record<string, string> {
  const next: Record<string, string> = { ...opts.extra };
  for (const row of GROUP_TOGGLES) {
    if (opts.toggles[row.key]) next[row.key] = 'true';
    else delete next[row.key];
  }
  for (const row of GROUP_TEXTS) {
    const value = (opts.texts[row.key] ?? '').trim();
    if (value) next[row.key] = value;
    else delete next[row.key];
  }
  return next;
}
