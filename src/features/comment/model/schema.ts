import { z } from 'zod';
import { charLength } from '../../../shared/text';

export const MAX_BODY = 2200;
export const PAGE_SIZE = 20;
/** How many replies each parent carries in `listComments`; the rest come from `listReplies`. */
export const INLINE_REPLIES = 3;

export const EMPTY_MESSAGE = 'コメントを入力してください';
export const TOO_LONG_MESSAGE = 'コメントは 2,200 字までです';
const NUL_MESSAGE = '使えない文字が含まれています';

/** Anything but a UUID can never name a row, so it is NOT_FOUND without a query. */
const uuid = z.uuid();
export const isId = (value: unknown): value is string => uuid.safeParse(value).success;

export const addCommentInput = z.strictObject({
  postId: z.uuid(),
  // Leading and trailing spaces are not part of the comment: they are cut off before counting.
  body: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .refine((s) => s !== '', EMPTY_MESSAGE)
        .refine((s) => charLength(s) <= MAX_BODY, TOO_LONG_MESSAGE)
        // SQLite's length() stops at NUL, which would let a long body past the CHECK.
        .refine((s) => !s.includes('\0'), NUL_MESSAGE),
    ),
  parentId: z.uuid().optional(),
  clientRequestId: z.uuid(),
});
export type AddCommentInput = z.infer<typeof addCommentInput>;

/** Field errors keyed by field name, for AppError('VALIDATION'). */
export function parseAddComment(
  input: unknown,
): { ok: true; data: AddCommentInput } | { ok: false; fieldErrors: Record<string, string[]> } {
  const result = addCommentInput.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'input';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return { ok: false, fieldErrors };
}

// The shapes handed to screens (docs/architecture/conventions.md "画面に返す形").
export type CommentAuthor = { username: string; displayName: string; avatarUrl: string | null };
export type CommentView = {
  id: string;
  author: CommentAuthor;
  body: string;
  parentId: string | null;
  /** ISO 8601, UTC. */
  createdAt: string;
  canDelete: boolean;
  replies?: CommentView[];
  replyCount?: number;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
