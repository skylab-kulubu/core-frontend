import { identityApi, type Person } from '@/lib/api/identity';

/**
 * Names a handful of people by id with GET /v1/users/{id} instead of reading the
 * whole directory. Ids already in `known` are not fetched; lookups that fail are skipped.
 */
export async function lookupPeople(
  ids: Iterable<string>,
  known: ReadonlyMap<string, Person> = new Map(),
  getUser: (id: string) => Promise<Person> = identityApi.getUser,
): Promise<Map<string, Person>> {
  const out = new Map(known);
  const missing = [...new Set(ids)].filter((id) => id && !out.has(id));
  const found = await Promise.all(missing.map((id) => getUser(id).catch(() => null)));
  for (const person of found) {
    if (person) {
      out.set(person.id, {
        id: person.id,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
      });
    }
  }
  return out;
}
