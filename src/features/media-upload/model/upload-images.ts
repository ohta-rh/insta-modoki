import type { ErrorBody } from '../../../shared/errors';
import {
  processImage,
  UploadError,
  type Crop,
  type ProcessedImage,
  type Variant,
} from './process-image';
import { validateFile } from './validate-file';

export const UPLOAD_FAILED_MESSAGE = 'アップロードに失敗しました。もう一度お試しください';
/** At most 4 PUTs in flight at once. */
const PUT_CONCURRENCY = 4;
const VARIANTS: Variant[] = ['orig', 'w320', 'w640', 'w1080'];

export type UploadedImage = { key: string; width: number; height: number; thumbhash: string };

type Slot = { key: string; putUrls: Record<Variant, string> };
export type UploadDeps = {
  process: (file: File, options: { crop?: Crop }) => Promise<ProcessedImage>;
  requestUrls: (
    input: unknown,
  ) => Promise<
    { ok: true; uploads: Slot[] } | { ok: false; error: Pick<ErrorBody, 'code' | 'message'> }
  >;
  fetch: typeof fetch;
};

async function defaultDeps(): Promise<UploadDeps> {
  // Loaded on first use so that importing this file never pulls the server action into a test.
  const { requestUploadUrlsAction } = await import('../api/actions');
  return {
    process: (file, options) => processImage(file, options),
    requestUrls: requestUploadUrlsAction,
    fetch: (...args) => fetch(...args),
  };
}

/** Runs `tasks` with at most `limit` in flight; rejects with the first failure. */
async function pool(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < tasks.length) {
      const task = tasks[next++]!;
      try {
        await task();
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

/**
 * Validate every photo, convert each, ask the server for URLs, PUT the 4 files of each (4 at a
 * time) and return what `createPost` needs. One failure fails the whole upload; files already put
 * stay in storage, tied to no post and shown nowhere.
 */
export async function uploadImages(
  files: File[],
  options: {
    crops?: (Crop | undefined)[];
    /** `fraction` goes from 0 to 1 for the photo at `index`. */
    onProgress?: (index: number, fraction: number) => void;
  } = {},
  deps?: UploadDeps,
): Promise<UploadedImage[]> {
  for (const file of files) {
    const check = validateFile(file);
    if (!check.ok) throw new UploadError(check.message);
  }
  const d = deps ?? (await defaultDeps());
  const progress = options.onProgress ?? (() => {});

  const processed: ProcessedImage[] = [];
  for (const [i, file] of files.entries()) {
    processed.push(await d.process(file, { crop: options.crops?.[i] }));
    progress(i, 0.2);
  }

  const response = await d.requestUrls({
    files: files.map((file, i) => ({
      contentType: file.type || contentTypeFromName(file.name),
      size: file.size,
      width: processed[i]!.width,
      height: processed[i]!.height,
      variantSizes: {
        orig: processed[i]!.blobs.orig.size,
        w320: processed[i]!.blobs.w320.size,
        w640: processed[i]!.blobs.w640.size,
        w1080: processed[i]!.blobs.w1080.size,
      },
    })),
  });
  if (!response.ok) throw new UploadError(response.error.message, response.error.code);
  if (response.uploads.length !== files.length)
    throw new UploadError(UPLOAD_FAILED_MESSAGE, 'INTERNAL');

  const done = files.map(() => 0);
  const tasks = response.uploads.flatMap((slot, i) =>
    VARIANTS.map((name) => async () => {
      let res: Response;
      try {
        res = await d.fetch(slot.putUrls[name], {
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
          body: processed[i]!.blobs[name],
        });
      } catch {
        throw new UploadError(UPLOAD_FAILED_MESSAGE, 'INTERNAL');
      }
      if (!res.ok) throw new UploadError(UPLOAD_FAILED_MESSAGE, 'INTERNAL');
      done[i] = (done[i] ?? 0) + 1;
      progress(i, 0.2 + 0.2 * done[i]!);
    }),
  );
  await pool(tasks, PUT_CONCURRENCY);

  return response.uploads.map((slot, i) => ({
    key: slot.key,
    width: processed[i]!.width,
    height: processed[i]!.height,
    thumbhash: processed[i]!.thumbhash,
  }));
}

/** For a photo whose type is empty (HEIC on some browsers); the extension was already validated. */
function contentTypeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/heic';
}
