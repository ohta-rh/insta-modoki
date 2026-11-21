import { z } from 'zod';
import { MAX_EDGE } from './resize';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from './validate-file';

export type UploadFile = {
  contentType: (typeof ALLOWED_CONTENT_TYPES)[number];
  size: number;
  width: number;
  height: number;
  variantSizes: { orig: number; w320: number; w640: number; w1080: number };
};

export type ParsedUploadRequest =
  | { ok: true; data: { files: UploadFile[] } }
  | { ok: false; code: 'VALIDATION' | 'PAYLOAD_TOO_LARGE'; fieldErrors?: Record<string, string[]> };

export const MAX_FILES = 10;

// A byte count has no upper bound here: an oversized one is PAYLOAD_TOO_LARGE, not VALIDATION.
const bytes = z.number().int().min(1);
const pixels = z.number().int().min(1).max(MAX_EDGE);

const schema = z.object({
  files: z
    .array(
      z.object({
        contentType: z.enum(ALLOWED_CONTENT_TYPES),
        size: bytes,
        width: pixels,
        height: pixels,
        variantSizes: z.object({ orig: bytes, w320: bytes, w640: bytes, w1080: bytes }),
      }),
    )
    .min(1)
    .max(MAX_FILES),
});

/** Shape first (VALIDATION), then byte limits (PAYLOAD_TOO_LARGE). Unknown fields such as `key` are dropped. */
export function parseUploadRequest(input: unknown): ParsedUploadRequest {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'files';
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return { ok: false, code: 'VALIDATION', fieldErrors };
  }
  const tooLarge = result.data.files.some(
    (f) => f.size > MAX_FILE_BYTES || Object.values(f.variantSizes).some((v) => v > MAX_FILE_BYTES),
  );
  if (tooLarge) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
  return { ok: true, data: result.data };
}
