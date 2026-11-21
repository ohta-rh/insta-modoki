import { z } from 'zod';
import type { MediaView, UserSummary } from '../../post';
import { charLength, hasControlChars } from '../../../shared/text';
import { BIO_MESSAGE, DISPLAY_NAME_MESSAGE, MAX_BIO, MAX_DISPLAY_NAME } from './limits';

/** Photos a profile page shows per request (docs/architecture/routes.md `listProfilePosts`). */
export const PROFILE_PAGE_SIZE = 12;

export type Page<T> = { items: T[]; nextCursor: string | null };

// The shapes handed to screens (docs/architecture/conventions.md "画面に返す形").
export type ProfileView = UserSummary & {
  bio: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  isMe: boolean;
  isFollowing: boolean;
};

export type PostThumb = { id: string; cover: MediaView; mediaCount: number };

export { BIO_MESSAGE, DISPLAY_NAME_MESSAGE, MAX_BIO, MAX_DISPLAY_NAME };
export const AVATAR_MESSAGE = '画像を選び直してください';

export type UpdateProfileInput = { displayName: string; bio: string; avatarKey?: string };
export type ParsedUpdateProfile =
  { ok: true; data: UpdateProfileInput } | { ok: false; fieldErrors: Record<string, string[]> };

const schema = z.object({
  displayName: z
    .string({ error: DISPLAY_NAME_MESSAGE })
    .transform((v) => v.trim())
    .refine((v) => charLength(v) >= 1 && charLength(v) <= MAX_DISPLAY_NAME && !hasControlChars(v), {
      error: DISPLAY_NAME_MESSAGE,
    }),
  // A newline is allowed in the bio; NUL is not (SQLite's length() stops at it).
  bio: z
    .string({ error: BIO_MESSAGE })
    .refine((v) => charLength(v) <= MAX_BIO && !v.includes('\0'), { error: BIO_MESSAGE }),
  avatarKey: z.string({ error: AVATAR_MESSAGE }).min(1, AVATAR_MESSAGE).optional(),
});

/** Shape and limits of `updateProfile`'s input (lengths in code points). */
export function parseUpdateProfile(input: unknown): ParsedUpdateProfile {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'input';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return { ok: false, fieldErrors };
}
