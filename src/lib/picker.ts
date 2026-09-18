export function pickerMatch(query: string, ...fields: Array<string | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => (field ?? '').toLowerCase().includes(q));
}

export function roleKey(role: { clientId: string; role: string }): string {
  return `${role.clientId}:${role.role}`;
}
