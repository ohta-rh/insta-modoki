// Limits and messages the client also needs. No zod here (ADR-0046).
export const STORY_TTL_MS = 86_400_000;
export const MAX_VIDEO_MS = 15_000;
export const MAX_VIDEO_BYTES = 31_457_280;
export const MAX_PHOTO_BYTES = 10_485_760;
export const MAX_MOOV_BYTES = 1_048_576;
export const MAX_BOX_HEADERS = 16;
export const PHOTO_MS = 5_000;
export const TRAY_MAX = 50;
export const VIEWERS_PAGE_SIZE = 20;
export const HOURLY_STORY_LIMIT = 30;
export const MAX_ALT_TEXT = 500;
/** Longest edge of the photo the browser stores (the same bound as a post's photo). */
export const MAX_IMAGE_EDGE = 2048;

export const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const VIDEO_TOO_LONG = '動画は 15 秒までです';
export const VIDEO_TOO_LARGE = 'ファイルが大きすぎます（動画は 30MB まで）';
export const VIDEO_UNREADABLE = '動画を読み込めませんでした';
export const NOT_UPLOADED = 'アップロードが完了していません';
export const BAD_TYPE = 'この形式は使えません（JPEG・PNG・WebP・HEIC・MP4）';
export const POST_FAILED = '投稿できませんでした。もう一度お試しください';
