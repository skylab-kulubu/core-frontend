import type { CertificateTemplateBinding } from '@/lib/api/certificates';

/** The key core gives the club-wide default binding. */
export const CLUB_SCOPE_KEY = 'SKY_LAB';

/** The names of the defaults a template is: "Kulüp varsayılanı", "GECEKODU varsayılanı". */
export function defaultLabels(
  templateId: string,
  bindings: readonly CertificateTemplateBinding[],
): string[] {
  const out: string[] = [];
  for (const binding of bindings) {
    if (binding.templateId !== templateId) continue;
    if (binding.scope === 'club') out.push('Kulüp varsayılanı');
    else if (binding.scope === 'ownerTeam') out.push(`${binding.scopeKey} varsayılanı`);
  }
  return out.sort((a, b) =>
    a.startsWith('Kulüp') ? -1 : b.startsWith('Kulüp') ? 1 : a.localeCompare(b, 'tr'),
  );
}

/** How many events have a template of their own, by template. */
export function eventUses(
  templateId: string,
  bindings: readonly CertificateTemplateBinding[],
): number {
  return bindings.filter((row) => row.scope === 'event' && row.templateId === templateId).length;
}

export type DefaultRow = {
  /** 'club' or a team name. */
  key: string;
  scope: 'club' | 'ownerTeam';
  label: string;
  binding?: CertificateTemplateBinding;
};

/**
 * The defaults table: the club first, then each team the reader sees, in name order, with
 * the binding each has (none means the club default applies).
 */
export function defaultRows(
  teams: readonly string[],
  bindings: readonly CertificateTemplateBinding[],
  showClub: boolean,
): DefaultRow[] {
  const rows: DefaultRow[] = [];
  if (showClub) {
    rows.push({
      key: 'club',
      scope: 'club',
      label: 'SKY LAB (kulüp)',
      binding: bindings.find((row) => row.scope === 'club'),
    });
  }
  for (const team of [...teams].sort((a, b) => a.localeCompare(b, 'tr'))) {
    rows.push({
      key: team,
      scope: 'ownerTeam',
      label: team,
      binding: bindings.find((row) => row.scope === 'ownerTeam' && row.scopeKey === team),
    });
  }
  return rows;
}
