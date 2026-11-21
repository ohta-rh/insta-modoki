import { z } from 'zod';

/** A post id is a UUID; anything else can never name a post, so it is NOT_FOUND without a query. */
const postId = z.uuid();

export const isPostId = (value: unknown): value is string => postId.safeParse(value).success;

// The shapes handed to screens (docs/architecture/conventions.md "画面に返す形").
export type UserSummary = { username: string; displayName: string; avatarUrl: string | null };

export type MediaView = {
  type: 'image';
  width: number;
  height: number;
  altText: string;
  thumbhash: string;
  srcset: { w320: string; w640: string; w1080: string };
};

export type PostView = {
  id: string;
  author: UserSummary;
  caption: string;
  media: MediaView[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** ISO 8601, UTC. */
  createdAt: string;
};
