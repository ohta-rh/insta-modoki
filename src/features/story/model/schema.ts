import { z } from 'zod';
import {
  BAD_TYPE,
  MAX_ALT_TEXT,
  MAX_IMAGE_EDGE,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MS,
  PHOTO_TYPES,
  VIDEO_TOO_LARGE,
  VIDEO_TOO_LONG,
} from './limits';

export type StoryUploadRequest =
  | {
      kind: 'image';
      file: {
        contentType: (typeof PHOTO_TYPES)[number];
        size: number;
        width: number;
        height: number;
        variantSizes: { orig: number; w320: number; w640: number; w1080: number };
      };
    }
  | { kind: 'video'; contentType: 'video/mp4'; size: number; durationMs: number };

export type ParsedStoryUpload =
  | { ok: true; data: StoryUploadRequest }
  | {
      ok: false;
      code: 'VALIDATION' | 'PAYLOAD_TOO_LARGE';
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

// A byte count has no upper bound here: an oversized one is PAYLOAD_TOO_LARGE, not VALIDATION.
const bytes = z.number().int().min(1);
const pixels = z.number().int().min(1).max(MAX_IMAGE_EDGE);

const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('image'),
    files: z
      .array(
        z.object({
          contentType: z.enum(PHOTO_TYPES),
          size: bytes,
          width: pixels,
          height: pixels,
          variantSizes: z.object({ orig: bytes, w320: bytes, w640: bytes, w1080: bytes }),
        }),
      )
      .length(1),
  }),
  z.object({
    kind: z.literal('video'),
    contentType: z.literal('video/mp4'),
    size: bytes,
    durationMs: z.number().int().min(1),
  }),
]);

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  const isType = error.issues.some((i) => i.path.at(-1) === 'contentType');
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'kind';
    (fieldErrors[path] ??= []).push(issue.path.at(-1) === 'contentType' ? BAD_TYPE : issue.message);
  }
  if (isType) fieldErrors.media = [BAD_TYPE];
  return fieldErrors;
}

/** Shape first (VALIDATION), then video length (VALIDATION), then byte limits (PAYLOAD_TOO_LARGE). */
export function parseStoryUploadRequest(input: unknown): ParsedStoryUpload {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { ok: false, code: 'VALIDATION', fieldErrors: fieldErrorsOf(result.error) };
  }
  const v = result.data;
  if (v.kind === 'video') {
    if (v.durationMs > MAX_VIDEO_MS) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: VIDEO_TOO_LONG,
        fieldErrors: { media: [VIDEO_TOO_LONG] },
      };
    }
    if (v.size > MAX_VIDEO_BYTES) {
      return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: VIDEO_TOO_LARGE };
    }
    return { ok: true, data: v };
  }
  const file = v.files[0]!;
  if (
    file.size > MAX_PHOTO_BYTES ||
    Object.values(file.variantSizes).some((n) => n > MAX_PHOTO_BYTES)
  ) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
  }
  return { ok: true, data: { kind: 'image', file } };
}

export type CreateStoryInput = {
  key: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  altText: string;
};

const createSchema = z
  .object({
    key: z.string().min(1).max(200),
    type: z.enum(['image', 'video']),
    width: z.number().int().min(1).max(MAX_IMAGE_EDGE).optional(),
    height: z.number().int().min(1).max(MAX_IMAGE_EDGE).optional(),
    altText: z.string().trim().max(MAX_ALT_TEXT),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'image' && (v.width === undefined || v.height === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['width'], message: '写真の大きさが必要です' });
    }
  });

export type ParsedCreateStory =
  { ok: true; data: CreateStoryInput } | { ok: false; fieldErrors: Record<string, string[]> };

/** Unknown fields are dropped; a video's width and height are ignored (the file is read instead). */
export function parseCreateStory(input: unknown): ParsedCreateStory {
  const result = createSchema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      (fieldErrors[issue.path.join('.') || 'key'] ??= []).push(issue.message);
    }
    return { ok: false, fieldErrors };
  }
  return { ok: true, data: result.data };
}

// ---- The viewer (#55) ----

const storyId = z.uuid();
/** A story id is a UUID; anything else can never name a story, so it is NOT_FOUND without a query. */
export const isStoryId = (value: unknown): value is string => storyId.safeParse(value).success;

export const storyReelInput = z.strictObject({ username: z.unknown() });
export const markStoryViewedInput = z.strictObject({ storyId: z.unknown() });
export const listStoryViewersInput = z.strictObject({
  storyId: z.unknown(),
  cursor: z.unknown().optional(),
});

const username = z.string().min(1).max(30);
/** The lower-cased username of a reel request, or null when it cannot name anyone (NOT_FOUND). */
export function readReelUsername(value: unknown): string | null {
  const parsed = username.safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}
