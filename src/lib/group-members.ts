export function memberSourceLabel(
  parentPath: string,
  sourcePath: string | undefined,
): string | undefined {
  if (!sourcePath || sourcePath === parentPath) return undefined;
  const parts = sourcePath.split('/').filter(Boolean);
  const parentParts = parentPath.split('/').filter(Boolean);
  const from = Math.max(0, parentParts.length - 1);
  const label = parts.slice(from).join(' / ');
  return label || undefined;
}

export function memberSubtitle(
  parentPath: string,
  person: { email: string; sourceGroupPath?: string },
): string {
  const source = memberSourceLabel(parentPath, person.sourceGroupPath);
  if (source && person.email) return `${source} · ${person.email}`;
  return source || person.email;
}
