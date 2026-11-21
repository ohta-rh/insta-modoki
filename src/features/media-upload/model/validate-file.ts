export type FileCheck = { ok: true } | { ok: false; message: string };

/** 10MB per photo (docs/architecture/conventions.md "上限とレート制限"). */
export const MAX_FILE_BYTES = 10_485_760;

export const TOO_LARGE_MESSAGE = 'ファイルが大きすぎます（1 枚 10MB まで）';
export const BAD_TYPE_MESSAGE = 'この形式は使えません（JPEG・PNG・WebP・HEIC）';

/** The source formats a photo may have; the same list guards `requestUploadUrls`. */
export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

function hasAllowedFormat(file: { name: string; type: string }): boolean {
  if (file.type !== '') return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type);
  // Some browsers leave the type empty for HEIC; then the extension decides.
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Format first, then size, so a GIF over 10MB says "format". No network is used. */
export function validateFile(file: { name: string; type: string; size: number }): FileCheck {
  if (!hasAllowedFormat(file)) return { ok: false, message: BAD_TYPE_MESSAGE };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: TOO_LARGE_MESSAGE };
  return { ok: true };
}
