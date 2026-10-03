import { ProblemError } from '@/lib/api/core';
import type { Media } from '@/lib/api/media';
import {
  uploadsApi,
  type DirectUploadPurpose,
  type UploadPart,
  type UploadSession,
} from '@/lib/api/uploads';
import { uploadErrorMessage } from './messages';

/** A refused or failed upload, with core's code (or one of ours) and the message to show. */
export class UploadError extends Error {
  code: string;
  fields: Record<string, unknown>;
  constructor(code: string, fields: Record<string, unknown> = {}) {
    super(uploadErrorMessage(code, fields));
    this.code = code;
    this.fields = fields;
  }
}

export type UploadProgress = {
  phase: 'starting' | 'uploading' | 'completing';
  /** Bytes R2 holds so far. */
  sent: number;
  total: number;
};

/** Where an open upload's id is kept, so a reload can continue it with the same file. */
export type UploadStore = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
};

const PREFIX = 'skylab.upload:';

export function sessionUploadStore(): UploadStore {
  const store = () => (typeof window === 'undefined' ? null : window.sessionStorage);
  return {
    get: (key) => {
      try {
        return store()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        store()?.setItem(key, value);
      } catch {
        // Not remembering only costs the resume after a reload.
      }
    },
    remove: (key) => {
      try {
        store()?.removeItem(key);
      } catch {}
    },
    keys: () => {
      try {
        const s = store();
        return s ? Array.from({ length: s.length }, (_, i) => s.key(i) ?? '') : [];
      } catch {
        return [];
      }
    },
  };
}

/** The same file picked again (name, size and modification time) continues its upload. */
export function uploadKey(purpose: DirectUploadPurpose, file: File): string {
  return `${PREFIX}${purpose}:${file.size}:${file.lastModified}:${file.name}`;
}

/** Names of files whose upload stopped half way and can continue when picked again. */
export function interruptedUploads(
  purpose: DirectUploadPurpose,
  store = sessionUploadStore(),
): string[] {
  const prefix = `${PREFIX}${purpose}:`;
  return store
    .keys()
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length).split(':').slice(2).join(':'));
}

// Ends the upload for good: the saved id is forgotten and retrying is pointless.
const TERMINAL = new Set([
  'purpose_not_available',
  'direct_upload_unavailable',
  'upload_size_mismatch',
]);

function toUploadError(error: unknown): UploadError {
  if (error instanceof UploadError) return error;
  if (error instanceof ProblemError) {
    if (error.status === 404) return new UploadError('upload_gone');
    return new UploadError(error.code ?? `http_${error.status}`, error.fields);
  }
  if (error instanceof DOMException && error.name === 'AbortError') throw error;
  return new UploadError('network');
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export type DirectUploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  /** Parts sent at once. */
  concurrency?: number;
  store?: UploadStore;
  /** Waits between retries, in ms; tests pass zeros. */
  backoff?: number[];
  /** Turns core's Retry-After seconds into the wait before completing again. */
  retryWait?: (seconds: number) => number;
};

/**
 * Sends a file straight to R2 through core's direct upload: start (or continue
 * a saved one), PUT every part to its presigned address a few at a time,
 * retrying failed parts and renewing expired addresses, then complete it.
 * Resolves with the Media, which must be linked to the Event within 24 hours.
 */
export async function directUpload(
  file: File,
  purpose: DirectUploadPurpose,
  {
    onProgress,
    signal,
    concurrency = 4,
    store = sessionUploadStore(),
    backoff = [500, 1500, 4000],
    retryWait = (seconds) => seconds * 1000,
  }: DirectUploadOptions = {},
): Promise<Media> {
  const key = uploadKey(purpose, file);
  const etags = new Map<number, string>();
  let sent = 0;
  let total = file.size;
  const report = (phase: UploadProgress['phase']) => onProgress?.({ phase, sent, total });

  const adopt = (session: UploadSession) => {
    total = session.size;
    for (const part of session.uploaded) {
      if (!etags.has(part.partNumber)) {
        etags.set(part.partNumber, part.etag);
        sent += part.size;
      }
    }
    return session;
  };

  const fail = (error: unknown): never => {
    const mapped = toUploadError(error);
    if (TERMINAL.has(mapped.code) || mapped.code === 'upload_gone') store.remove(key);
    throw mapped;
  };

  report('starting');
  let session: UploadSession;
  const saved = store.get(key);
  try {
    if (saved) {
      try {
        session = adopt(await uploadsApi.parts(saved));
      } catch (error) {
        // An upload that ended or expired starts over
        if (!(error instanceof ProblemError && error.status === 404)) throw error;
        store.remove(key);
        session = adopt(await uploadsApi.start({ purpose, name: file.name, size: file.size }));
      }
    } else {
      session = adopt(await uploadsApi.start({ purpose, name: file.name, size: file.size }));
    }
  } catch (error) {
    return fail(error);
  }
  store.set(key, session.id);
  const { id, partSize } = session;

  async function sendPart(part: UploadPart): Promise<'ok' | 'expired' | 'failed'> {
    const start = (part.partNumber - 1) * partSize;
    for (let attempt = 0; attempt <= backoff.length; attempt += 1) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const response = await fetch(part.url, {
          method: 'PUT',
          body: file.slice(start, start + part.size),
          signal,
        });
        if (response.ok) {
          const etag = response.headers.get('ETag');
          if (!etag) return 'failed';
          etags.set(part.partNumber, etag);
          sent += part.size;
          report('uploading');
          return 'ok';
        }
        // A presigned address that expired answers 403; core hands out new ones
        if (response.status === 403) return 'expired';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
      }
      if (attempt < backoff.length) await sleep(backoff[attempt]!, signal);
    }
    return 'failed';
  }

  async function sendAll(parts: UploadPart[]) {
    const queue = parts.filter((part) => !etags.has(part.partNumber));
    let failed = false;
    const worker = async () => {
      for (let part = queue.shift(); part; part = queue.shift()) {
        if ((await sendPart(part)) !== 'ok') failed = true;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    return !failed;
  }

  // Up to two rounds of fresh addresses for parts that failed or whose address expired
  let parts = session.parts;
  for (let round = 0; ; round += 1) {
    report('uploading');
    if (await sendAll(parts)) break;
    if (round >= 2) throw new UploadError('part_failed');
    try {
      parts = adopt(await uploadsApi.parts(id)).parts;
    } catch (error) {
      return fail(error);
    }
  }

  report('completing');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const body = [...etags.entries()]
      .sort(([a], [b]) => a - b)
      .map(([partNumber, etag]) => ({ partNumber, etag }));
    try {
      const media = await uploadsApi.complete(id, body);
      store.remove(key);
      return media;
    } catch (error) {
      if (!(error instanceof ProblemError)) return fail(error);
      const retryAfter = Number(error.fields.retryAfterSeconds) || 2;
      if (error.code === 'upload_completing' || error.code === 'upload_claim_lost') {
        await sleep(retryWait(retryAfter), signal);
        continue;
      }
      if (error.code === 'upload_parts_mismatch') {
        // R2 holds other parts than we listed: ask what it has and send the rest
        etags.clear();
        sent = 0;
        try {
          const fresh = adopt(await uploadsApi.parts(id));
          if (!(await sendAll(fresh.parts))) throw new UploadError('part_failed');
        } catch (inner) {
          return fail(inner);
        }
        continue;
      }
      return fail(error);
    }
  }
  throw new UploadError('complete_failed');
}
