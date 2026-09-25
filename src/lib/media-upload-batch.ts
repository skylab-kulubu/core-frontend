import { mediaApi, type Media } from '@/lib/api/media';
import { ProblemError } from '@/lib/api/core';
import {
  coreProblemMessage,
  isPerFileRefusal,
  SINGLE_STEP_MAX_BYTES,
  uploadRetryAfterSeconds,
} from '@/lib/core-problems';
import type { MediaPurpose } from '@/lib/media-purposes';

export type MediaBatchResult = {
  /** The Media that uploaded, in the order given. */
  uploaded: Media[];
  /** Files core refused for themselves, each with its Turkish reason. */
  refused: { file: File; message: string }[];
  /** Set when a refusal stopped the batch: its reason and the files not yet sent. */
  stopped?: { message: string; rest: File[]; retryAfterSeconds?: number };
};

/**
 * Uploads the files one at a time for one purpose. A file core refuses for
 * itself (too large, wrong type) is skipped, and so is a file above what core
 * takes in one request, without sending it: core would drop the connection
 * or answer a bare 413. Any other refusal, such as the upload limit, stops the
 * batch; what uploaded before it is always returned.
 */
export async function uploadMediaBatch(
  files: ReadonlyArray<File>,
  purpose: MediaPurpose,
  upload: (file: File, purpose: MediaPurpose) => Promise<Media> = mediaApi.upload,
): Promise<MediaBatchResult> {
  const result: MediaBatchResult = { uploaded: [], refused: [] };
  for (const [index, file] of files.entries()) {
    try {
      if (file.size > SINGLE_STEP_MAX_BYTES) {
        throw new ProblemError(413, 'Content Too Large');
      }
      result.uploaded.push(await upload(file, purpose));
    } catch (cause) {
      if (isPerFileRefusal(cause)) {
        result.refused.push({ file, message: coreProblemMessage(cause) });
        continue;
      }
      result.stopped = {
        message: coreProblemMessage(cause, 'Yüklenemedi'),
        rest: files.slice(index),
        retryAfterSeconds: uploadRetryAfterSeconds(cause),
      };
      break;
    }
  }
  return result;
}
