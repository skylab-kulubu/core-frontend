/** @jest-environment node */
import { directUpload, interruptedUploads, uploadKey, type UploadStore } from './direct-upload';

const PART = 4;

function memoryStore(
  initial: Record<string, string> = {},
): UploadStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: (key) => data[key] ?? null,
    set: (key, value) => {
      data[key] = value;
    },
    remove: (key) => {
      delete data[key];
    },
    keys: () => Object.keys(data),
  };
}

type Behaviour = {
  /** Answers for a part's PUT, consumed in order; then 200. */
  put?: Record<number, number[]>;
  /** Problem answers for /complete, consumed in order; then 201. */
  complete?: { status: number; code: string; retryAfterSeconds?: number }[];
  /** Parts R2 already holds when /parts is called. */
  held?: number[];
  startProblem?: { status: number; code: string; maxBytes?: number };
  partsStatus?: number;
};

/** A fake core and R2: core answers /v1/uploads*, R2 answers the presigned PUTs. */
function fakeServer(size: number, behaviour: Behaviour = {}) {
  const count = Math.ceil(size / PART);
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const putQueue = Object.fromEntries(
    Object.entries(behaviour.put ?? {}).map(([n, list]) => [n, [...list]]),
  );
  const completeQueue = [...(behaviour.complete ?? [])];
  let issued = 0;
  const parts = (skip: number[] = []) =>
    Array.from({ length: count }, (_, i) => i + 1)
      .filter((n) => !skip.includes(n))
      .map((n) => ({
        partNumber: n,
        size: Math.min(PART, size - (n - 1) * PART),
        url: `https://r2.test/pending/up1?partNumber=${n}&v=${issued}`,
      }));
  const session = (uploaded: number[] = []) => ({
    id: 'up1',
    purpose: 'video',
    name: 'acilis.mp4',
    size,
    partSize: PART,
    partCount: count,
    expiresAt: '2026-10-04T00:00:00Z',
    uploaded: uploaded.map((n) => ({
      partNumber: n,
      size: Math.min(PART, size - (n - 1) * PART),
      etag: `"held-${n}"`,
    })),
    parts: parts(uploaded),
    partUrlsExpireAt: '2026-10-03T13:00:00Z',
  });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchMock = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    calls.push({
      method,
      url,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    if (url.endsWith('/api/auth/token')) return json(200, { token: 't' });
    if (url.startsWith('https://r2.test/')) {
      const n = Number(new URL(url).searchParams.get('partNumber'));
      const next = putQueue[n]?.shift();
      if (next === -1) throw new TypeError('network');
      if (next && next !== 200) return new Response('', { status: next });
      return new Response('', { status: 200, headers: { ETag: `"etag-${n}"` } });
    }
    if (url.endsWith('/v1/uploads') && method === 'POST') {
      if (behaviour.startProblem)
        return json(behaviour.startProblem.status, behaviour.startProblem);
      issued += 1;
      return json(201, session());
    }
    if (url.endsWith('/v1/uploads/up1/parts')) {
      if (behaviour.partsStatus) return json(behaviour.partsStatus, { title: 'gone' });
      issued += 1;
      return json(200, session(behaviour.held ?? []));
    }
    if (url.endsWith('/v1/uploads/up1/complete')) {
      const problem = completeQueue.shift();
      if (problem) return json(problem.status, problem);
      return json(201, { id: 'up1', name: 'acilis.mp4', status: 'pending' });
    }
    return json(404, { title: 'not found' });
  });
  return { fetchMock, calls };
}

const file = (size: number) =>
  new File([new Uint8Array(size)], 'acilis.mp4', { type: 'video/mp4', lastModified: 1 });
const fast = { backoff: [0, 0, 0], retryWait: () => 0 };

describe('directUpload', () => {
  afterEach(() => jest.restoreAllMocks());

  it('splits the file into parts, sends them and completes with every ETag in order', async () => {
    const { fetchMock, calls } = fakeServer(10);
    global.fetch = fetchMock as typeof fetch;
    const store = memoryStore();
    const progress: number[] = [];
    const media = await directUpload(file(10), 'video', {
      ...fast,
      store,
      onProgress: (p) => progress.push(p.sent),
    });

    expect(media.id).toBe('up1');
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(3);
    const complete = calls.find((c) => c.url.endsWith('/complete'));
    expect(complete?.body).toEqual({
      parts: [
        { partNumber: 1, etag: '"etag-1"' },
        { partNumber: 2, etag: '"etag-2"' },
        { partNumber: 3, etag: '"etag-3"' },
      ],
    });
    expect(progress.at(-1)).toBe(10);
    expect(store.data).toEqual({});
  });

  it('retries a failed part and renews addresses that expired', async () => {
    const { fetchMock, calls } = fakeServer(10, { put: { 2: [500, -1], 3: [403] } });
    global.fetch = fetchMock as typeof fetch;
    await directUpload(file(10), 'video', { ...fast, store: memoryStore() });
    expect(calls.filter((c) => c.url.includes('partNumber=2'))).toHaveLength(3);
    expect(calls.some((c) => c.url.endsWith('/parts'))).toBe(true);
    expect(calls.filter((c) => c.url.includes('partNumber=3'))).toHaveLength(2);
  });

  it('continues a saved upload, sending only the parts R2 does not hold', async () => {
    const { fetchMock, calls } = fakeServer(10, { held: [1, 2] });
    global.fetch = fetchMock as typeof fetch;
    const store = memoryStore({ [uploadKey('video', file(10))]: 'up1' });
    await directUpload(file(10), 'video', { ...fast, store });
    expect(calls.some((c) => c.url.endsWith('/v1/uploads'))).toBe(false);
    expect(
      calls
        .filter((c) => c.method === 'PUT')
        .map((c) => new URL(c.url).searchParams.get('partNumber')),
    ).toEqual(['3']);
    expect(calls.find((c) => c.url.endsWith('/complete'))?.body).toEqual({
      parts: [
        { partNumber: 1, etag: '"held-1"' },
        { partNumber: 2, etag: '"held-2"' },
        { partNumber: 3, etag: '"etag-3"' },
      ],
    });
  });

  it('starts over when the saved upload is gone', async () => {
    const { fetchMock, calls } = fakeServer(5, { partsStatus: 404 });
    global.fetch = fetchMock as typeof fetch;
    const store = memoryStore({ [uploadKey('video', file(5))]: 'old' });
    await directUpload(file(5), 'video', { ...fast, store });
    expect(calls.some((c) => c.url.endsWith('/v1/uploads') && c.method === 'POST')).toBe(true);
  });

  it('waits while another request completes it, and resends parts R2 does not have', async () => {
    const { fetchMock, calls } = fakeServer(10, {
      complete: [
        { status: 409, code: 'upload_completing', retryAfterSeconds: 1 },
        { status: 400, code: 'upload_parts_mismatch' },
      ],
      held: [1, 3],
    });
    global.fetch = fetchMock as typeof fetch;
    const media = await directUpload(file(10), 'video', { ...fast, store: memoryStore() });
    expect(media.id).toBe('up1');
    expect(calls.filter((c) => c.url.endsWith('/complete'))).toHaveLength(3);
    // After the mismatch only part 2 goes again
    expect(calls.filter((c) => c.method === 'PUT').at(-1)?.url).toContain('partNumber=2');
  });

  it('refuses with a message and forgets the upload when the purpose is off', async () => {
    const { fetchMock } = fakeServer(5, {
      startProblem: { status: 422, code: 'purpose_not_available' },
    });
    global.fetch = fetchMock as typeof fetch;
    await expect(
      directUpload(file(5), 'video', { ...fast, store: memoryStore() }),
    ).rejects.toMatchObject({
      code: 'purpose_not_available',
      message: 'Şu an kullanılamıyor.',
    });
  });

  it('names the size limit when the file is too large', async () => {
    const { fetchMock } = fakeServer(5, {
      startProblem: { status: 413, code: 'media_too_large', maxBytes: 2 * 1024 ** 3 },
    });
    global.fetch = fetchMock as typeof fetch;
    await expect(
      directUpload(file(5), 'video', { ...fast, store: memoryStore() }),
    ).rejects.toMatchObject({
      code: 'media_too_large',
      message: 'Dosya çok büyük (en çok 2 GB).',
    });
  });
});

describe('interruptedUploads', () => {
  it('lists the names of uploads waiting for their file', () => {
    const store = memoryStore({
      [uploadKey('video', file(5))]: 'up1',
      'skylab.upload:club_file:9:1:rapor.pdf': 'up2',
      other: 'x',
    });
    expect(interruptedUploads('video', store)).toEqual(['acilis.mp4']);
  });
});
