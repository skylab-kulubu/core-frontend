/**
 * sky-raffle-v1, the draw core runs, repeated in the browser so anyone can check a Raffle
 * from its published seed and list (core docs/raffle.md):
 *
 * - ids: the eligible Ticket ids, lower-case UUIDs in ascending order;
 *   listHash = hex(SHA-256(UTF-8 of ids joined by "\n")), no newline at the end.
 * - next(): SHA-256(seed (32 bytes) || listHash (32 bytes) || counter as big-endian uint64),
 *   counter from 0 and one up per call; the block's first 8 bytes as a big-endian uint64.
 * - uniform(m): draws again while x ≥ 2^64 − (2^64 mod m), then x mod m.
 * - for i in 0..k−1: j = i + uniform(n − i), swap a[i] and a[j]; the order is a[0..k).
 */

export const RAFFLE_ALGORITHM = 'sky-raffle-v1';

const TWO_64 = BigInt(1) << BigInt(64);

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('Bu tarayıcı SHA-256 hesaplayamıyor');
  return api;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest('SHA-256', bytes as BufferSource));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 32 bytes from 64 hex characters; null for anything else. */
function hex32(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** The ids as the list is hashed: lower case, ascending. */
export function canonicalTicketIds(ids: readonly string[]): string[] {
  return ids.map((id) => id.trim().toLowerCase()).sort();
}

/** hex(SHA-256(ids joined by "\n")) of the ids in canonical order. */
export async function raffleListHash(ids: readonly string[]): Promise<string> {
  const text = canonicalTicketIds(ids).join('\n');
  return toHex(await sha256(new TextEncoder().encode(text)));
}

/**
 * The first `k` Ticket ids of the draw for `seed` over `ids` (whose hash is `listHash`).
 * Throws for a seed or list hash that is not 64 hex characters, or a `k` above the list.
 */
export async function raffleDrawOrder(
  seed: string,
  listHash: string,
  ids: readonly string[],
  k: number,
): Promise<string[]> {
  const seedBytes = hex32(seed);
  const hashBytes = hex32(listHash);
  if (!seedBytes || !hashBytes)
    throw new Error('Tohum ya da liste özeti 64 onaltılık karakter değil');
  const a = canonicalTicketIds(ids);
  const n = a.length;
  if (!Number.isInteger(k) || k < 0 || k > n) throw new Error('Çekilen sayısı listeden büyük');

  const block = new Uint8Array(72);
  block.set(seedBytes, 0);
  block.set(hashBytes, 32);
  const view = new DataView(block.buffer);
  let counter = BigInt(0);
  const next = async (): Promise<bigint> => {
    view.setBigUint64(64, counter, false);
    counter += BigInt(1);
    const digest = await sha256(block);
    return new DataView(digest.buffer, digest.byteOffset, 8).getBigUint64(0, false);
  };
  const uniform = async (m: number): Promise<number> => {
    const mod = BigInt(m);
    const limit = TWO_64 - (TWO_64 % mod);
    let x = await next();
    while (x >= limit) x = await next();
    return Number(x % mod);
  };

  for (let i = 0; i < k; i += 1) {
    const j = i + (await uniform(n - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

/** core's GET …/raffles/{id}/verification. */
export type RaffleVerification = {
  algorithm: string;
  seed: string;
  listHash: string;
  /** The eligible Ticket ids, in canonical order. */
  ticketIds: string[];
  /** The drawn Ticket ids, position 1 first. */
  order: string[];
};

export type RaffleCheck = {
  /** The algorithm is one this page knows. */
  algorithm: boolean;
  /** The list's SHA-256 is the published list hash. */
  list: boolean;
  /** The seed over the list gives the published order. */
  order: boolean;
  /** The Raffle's entries stand in that order (true when no entries were given). */
  entries: boolean;
};

/**
 * Checks a Raffle's published draw. `entries`, when given, are the Raffle's rows (position and
 * Ticket id): each must hold the Ticket the order puts at its position.
 */
export async function verifyRaffle(
  verification: RaffleVerification,
  entries?: readonly { position: number; ticketId: string }[],
): Promise<RaffleCheck> {
  if (verification.algorithm !== RAFFLE_ALGORITHM) {
    return { algorithm: false, list: false, order: false, entries: false };
  }
  const list =
    (await raffleListHash(verification.ticketIds)) === verification.listHash.toLowerCase();
  const published = verification.order.map((id) => id.toLowerCase());
  let order = false;
  try {
    const drawn = await raffleDrawOrder(
      verification.seed,
      verification.listHash,
      verification.ticketIds,
      published.length,
    );
    order = drawn.length === published.length && drawn.every((id, i) => id === published[i]);
  } catch {
    order = false;
  }
  const rows = entries ?? [];
  const entriesMatch = rows.every(
    (row) => published[row.position - 1] === row.ticketId.toLowerCase(),
  );
  return { algorithm: true, list, order, entries: entriesMatch };
}

/** The result in one line: what held, or which check did not. */
export function raffleCheckLine(check: RaffleCheck): string {
  if (!check.algorithm) return 'Bu çekilişin algoritması tanınmıyor';
  const parts = [
    check.list ? 'Liste özeti tutuyor' : 'Liste özeti tutmuyor',
    check.order ? 'Sıra tohumla aynı' : 'Sıra tohumla aynı değil',
  ];
  if (!check.entries) parts.push('Sonuç listesi sırayla uyuşmuyor');
  return parts.join(' · ');
}

export function raffleCheckPassed(check: RaffleCheck): boolean {
  return check.algorithm && check.list && check.order && check.entries;
}
