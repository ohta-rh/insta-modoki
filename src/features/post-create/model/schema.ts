import { z } from 'zod';
import { charLength } from '../../../shared/text';

export const MAX_PHOTOS = 10;
export const MAX_CAPTION = 2200;
export const MAX_ALT_TEXT = 500;
/** The long edge of a stored original (`media-upload` shrinks to this). */
const MAX_EDGE = 2048;

export const MEDIA_MESSAGE = `写真は 1 枚から ${MAX_PHOTOS} 枚までです`;
export const CAPTION_MESSAGE = 'キャプションは 2,200 字までです';
export const ALT_TEXT_MESSAGE = '代替テキストは 500 字までです';
export const NOT_UPLOADED_MESSAGE = '写真のアップロードが完了していません';

export type CreatePostInput = {
  caption: string;
  media: { key: string; width: number; height: number; altText: string; thumbhash: string }[];
  clientRequestId: string;
};
export type ParsedCreatePost =
  | { ok: true; data: CreatePostInput }
  | { ok: false; fieldErrors: Record<string, string[]> };

/** No NUL: SQLite's length() stops at it, which would let a long text past the CHECK. */
const text = (max: number, message: string) =>
  z
    .string()
    .refine((s) => charLength(s) <= max, message)
    .refine((s) => !s.includes('\0'), '使えない文字が含まれています');
const pixels = z.number().int().min(1).max(MAX_EDGE);

const schema = z.object({
  caption: text(MAX_CAPTION, CAPTION_MESSAGE),
  media: z
    .array(
      z.object({
        key: z.string().min(1),
        width: pixels,
        height: pixels,
        altText: text(MAX_ALT_TEXT, ALT_TEXT_MESSAGE),
        thumbhash: z
          .string()
          .max(40)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      }),
    )
    .min(1, MEDIA_MESSAGE)
    .max(MAX_PHOTOS, MEDIA_MESSAGE),
  clientRequestId: z.uuid(),
});

/** Shape and limits of `createPost`'s input. Text is kept as sent (leading and trailing spaces too). */
export function parseCreatePost(input: unknown): ParsedCreatePost {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'input';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return { ok: false, fieldErrors };
}
