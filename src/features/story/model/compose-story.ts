import { UploadError, uploadImages, validateFile } from '../../media-upload';
import type { ErrorBody } from '../../../shared/errors';
import {
  BAD_TYPE,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MS,
  PHOTO_TYPES,
  POST_FAILED,
  VIDEO_TOO_LARGE,
  VIDEO_TOO_LONG,
  VIDEO_UNREADABLE,
} from './limits';
import { readMp4Info } from './mp4-info';

type UploadDeps = NonNullable<Parameters<typeof uploadImages>[2]>;
type Failure = { ok: false; error: Pick<ErrorBody, 'code' | 'message'> };
type UploadAnswer = { ok: true; key: string; putUrls: Partial<Record<string, string>> } | Failure;

/** What `composeStory` needs from outside: the photo converter, `fetch` and the two Server Actions. */
export type ComposeDeps = Pick<UploadDeps, 'process' | 'fetch'> & {
  requestStoryUpload: (input: unknown) => Promise<UploadAnswer>;
  createStory: (input: unknown) => Promise<{ ok: true; storyId: string } | Failure>;
};

export type ComposeResult = { ok: true; storyId: string } | { ok: false; message: string };
export type VideoCheck = { ok: true; durationMs: number } | { ok: false; message: string };

const extensionOf = (name: string): string => name.toLowerCase().split('.').pop() ?? '';

/** A video by its type, or by its extension when the browser leaves the type empty. */
export function isVideoFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type !== ''
    ? file.type.startsWith('video/')
    : ['mp4', 'mov'].includes(extensionOf(file.name));
}

function isPhotoFormat(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type !== '') return (PHOTO_TYPES as readonly string[]).includes(file.type);
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extensionOf(file.name));
}

/**
 * Everything about a video that can be known without the network: MP4 only, at most 30MB, and
 * at most 15 s by the file's own `mvhd` (the same reader the server uses).
 */
export async function inspectVideo(file: File): Promise<VideoCheck> {
  const isMp4 = file.type === 'video/mp4' || (file.type === '' && extensionOf(file.name) === 'mp4');
  if (!isMp4) return { ok: false, message: BAD_TYPE };
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, message: VIDEO_TOO_LARGE };
  let info;
  try {
    info = await readMp4Info(
      async (offset, length) =>
        new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
      file.size,
    );
  } catch {
    info = null;
  }
  if (info === null || info.durationMs < 1) return { ok: false, message: VIDEO_UNREADABLE };
  if (info.durationMs > MAX_VIDEO_MS) return { ok: false, message: VIDEO_TOO_LONG };
  return { ok: true, durationMs: info.durationMs };
}

/** The photo checks of the screen: the formats of a story (MP4 aside) and 10MB. */
export function inspectPhoto(file: File): { ok: true } | { ok: false; message: string } {
  if (!isPhotoFormat(file)) return { ok: false, message: BAD_TYPE };
  const check = validateFile(file);
  return check.ok ? { ok: true } : { ok: false, message: check.message };
}

async function putFile(deps: ComposeDeps, url: string, file: Blob, type: string): Promise<boolean> {
  try {
    const res = await deps.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': type },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function composeVideo(
  file: File,
  altText: string,
  deps: ComposeDeps,
): Promise<ComposeResult> {
  const check = await inspectVideo(file);
  if (!check.ok) return check;
  const slot = await deps.requestStoryUpload({
    kind: 'video',
    contentType: 'video/mp4',
    size: file.size,
    durationMs: check.durationMs,
  });
  if (!slot.ok) return { ok: false, message: slot.error.message };
  if (!(await putFile(deps, slot.putUrls.video!, file, 'video/mp4'))) {
    return { ok: false, message: POST_FAILED };
  }
  const created = await deps.createStory({ key: slot.key, type: 'video', altText });
  return created.ok
    ? { ok: true, storyId: created.storyId }
    : { ok: false, message: created.error.message };
}

async function composePhoto(
  file: File,
  altText: string,
  deps: ComposeDeps,
): Promise<ComposeResult> {
  const check = inspectPhoto(file);
  if (!check.ok) return check;
  type Slot = Awaited<ReturnType<UploadDeps['requestUrls']>>;
  let images;
  try {
    images = await uploadImages(
      [file],
      {},
      {
        process: deps.process,
        fetch: deps.fetch,
        requestUrls: async (input): Promise<Slot> => {
          const slot = await deps.requestStoryUpload({ kind: 'image', ...(input as object) });
          if (!slot.ok) return slot;
          const putUrls = slot.putUrls as Record<'orig' | 'w320' | 'w640' | 'w1080', string>;
          return { ok: true, uploads: [{ key: slot.key, putUrls }] };
        },
      },
    );
  } catch (error) {
    return { ok: false, message: error instanceof UploadError ? error.message : POST_FAILED };
  }
  const image = images[0]!;
  const created = await deps.createStory({
    key: image.key,
    type: 'image',
    width: image.width,
    height: image.height,
    altText,
  });
  return created.ok
    ? { ok: true, storyId: created.storyId }
    : { ok: false, message: created.error.message };
}

/**
 * Posts one story: a photo (converted to four WebP files) or an MP4 (put as it is). The checks
 * that need no network come first, so a refused file sends nothing. Never throws.
 */
export async function composeStory(
  input: { file: File; altText: string },
  deps: ComposeDeps,
): Promise<ComposeResult> {
  try {
    return isVideoFile(input.file)
      ? await composeVideo(input.file, input.altText, deps)
      : await composePhoto(input.file, input.altText, deps);
  } catch {
    return { ok: false, message: POST_FAILED };
  }
}
