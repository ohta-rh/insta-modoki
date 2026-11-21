import type { MediaView, UserSummary } from '../../post';

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
