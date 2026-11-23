import { z } from 'zod';
import { isPostId } from '../../post';

export type FieldErrors = Record<string, string[]>;
export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

export const ADMIN_PAGE_SIZE = 20;
export const CAPTION_EXCERPT_LENGTH = 50;

const NOT_FOUND = 'ページが見つかりません';

export const adminDeletePostInput = z.strictObject({
  postId: z.string({ error: NOT_FOUND }).refine(isPostId, NOT_FOUND),
});
export const adminDeleteUserInput = z.strictObject({
  username: z.string({ error: NOT_FOUND }).min(1, NOT_FOUND).max(30, NOT_FOUND),
});
export const listAdminPostsInput = z.strictObject({ cursor: z.string().optional() });
export const listAdminUsersInput = z.strictObject({
  query: z.string().max(30, 'ユーザー名は 30 文字までです').optional(),
  cursor: z.string().optional(),
});

function parse<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const r = schema.safeParse(input ?? {});
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    const list = (fieldErrors[key] ??= []);
    if (!list.includes(issue.message)) list.push(issue.message);
  }
  return { ok: false, fieldErrors };
}

export const parseAdminDeletePost = (input: unknown) => parse(adminDeletePostInput, input);
export const parseAdminDeleteUser = (input: unknown) => parse(adminDeleteUserInput, input);
export const parseListAdminPosts = (input: unknown) => parse(listAdminPostsInput, input);
export const parseListAdminUsers = (input: unknown) => parse(listAdminUsersInput, input);

export type AdminPostRow = {
  id: string;
  authorUsername: string;
  captionExcerpt: string;
  createdAt: Date;
};
export type AdminUserRow = {
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  postCount: number;
  createdAt: Date;
};
export type AdminPage<T> = { items: T[]; nextCursor: string | null };
