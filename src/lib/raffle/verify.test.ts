/**
 * @jest-environment node
 */
import {
  raffleCheckLine,
  raffleCheckPassed,
  raffleDrawOrder,
  raffleListHash,
  verifyRaffle,
  type RaffleVerification,
} from './verify';

// The vector core's Go tests use too (core docs/raffles.md)
const IDS = [
  '0b6f3c1e-4d2a-4f7e-9a51-1c2d3e4f5a61',
  '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  '2f9e8d7c-6b5a-4c3d-9e2f-1a0b9c8d7e6f',
  '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
  '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b',
  '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
  '6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f',
  '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b',
  '8a9b0c1d-2e3f-4a4b-9c5d-6e7f8a9b0c1d',
  '9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f',
];
const SEED = '8f1c2b7a9d3e4f5061728394a5b6c7d8e9f00112233445566778899aabbccdde';
const LIST_HASH = '640cfca901485c396ae9b9c63c423e026a8410dda2a763eed8323be801b6c85b';
const ORDER = [
  '8a9b0c1d-2e3f-4a4b-9c5d-6e7f8a9b0c1d',
  '6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f',
  '2f9e8d7c-6b5a-4c3d-9e2f-1a0b9c8d7e6f',
  '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b',
  '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
];

const published: RaffleVerification = {
  algorithm: 'sky-raffle-v1',
  seed: SEED,
  listHash: LIST_HASH,
  ticketIds: IDS,
  order: ORDER,
};

describe('sky-raffle-v1', () => {
  it('hashes the sorted list as core does', async () => {
    await expect(raffleListHash(IDS)).resolves.toBe(LIST_HASH);
    // Order and case do not change the canonical list
    await expect(raffleListHash([...IDS].reverse().map((id) => id.toUpperCase()))).resolves.toBe(
      LIST_HASH,
    );
  });

  it('draws the vector order from the seed', async () => {
    await expect(raffleDrawOrder(SEED, LIST_HASH, IDS, 5)).resolves.toEqual(ORDER);
  });

  it('passes a published draw and its entries', async () => {
    const entries = ORDER.map((ticketId, i) => ({ position: i + 1, ticketId }));
    const check = await verifyRaffle(published, entries);
    expect(check).toEqual({ algorithm: true, list: true, order: true, entries: true });
    expect(raffleCheckPassed(check)).toBe(true);
    expect(raffleCheckLine(check)).toBe('Liste özeti tutuyor · Sıra tohumla aynı');
  });

  it('says the list hash does not hold when a ticket was swapped', async () => {
    const ticketIds = [...IDS.slice(0, 9), 'ffffffff-ffff-4fff-8fff-ffffffffffff'];
    const check = await verifyRaffle({ ...published, ticketIds });
    expect(check.list).toBe(false);
    expect(raffleCheckPassed(check)).toBe(false);
    expect(raffleCheckLine(check)).toMatch(/^Liste özeti tutmuyor/);
  });

  it('says the order does not follow the seed when two places changed', async () => {
    const order = [ORDER[1], ORDER[0], ...ORDER.slice(2)];
    const check = await verifyRaffle({ ...published, order });
    expect(check).toMatchObject({ list: true, order: false });
    expect(raffleCheckLine(check)).toBe('Liste özeti tutuyor · Sıra tohumla aynı değil');
  });

  it('says the order does not follow when the seed differs', async () => {
    const check = await verifyRaffle({ ...published, seed: `${SEED.slice(0, 63)}f` });
    expect(check.order).toBe(false);
  });

  it('catches a result list that does not stand in the drawn order', async () => {
    const entries = [
      { position: 1, ticketId: ORDER[0] },
      { position: 2, ticketId: ORDER[2] },
    ];
    const check = await verifyRaffle(published, entries);
    expect(check.entries).toBe(false);
    expect(raffleCheckLine(check)).toContain('Sonuç listesi sırayla uyuşmuyor');
  });

  it('does not check an algorithm it does not know', async () => {
    const check = await verifyRaffle({ ...published, algorithm: 'sky-raffle-v2' });
    expect(raffleCheckPassed(check)).toBe(false);
    expect(raffleCheckLine(check)).toBe('Bu çekilişin algoritması tanınmıyor');
  });
});
