import { z } from 'zod';

export type SecurityConfig = {
  mediaOrigin: string | null;
  /** Where the browser PUTs signed uploads (the S3 endpoint's origin); allowed in connect-src. */
  uploadOrigin: string | null;
  production: boolean;
};

const MEDIA_ORIGIN_MESSAGE = 'MEDIA_ORIGIN は origin（例 https://example.com）で指定してください';

// `;`, whitespace and control characters would let a value open a new CSP directive or header,
// so they are rejected before the value is parsed as a URL.
const hasUnsafeChar = (value: string): boolean =>
  [...value].some((c) => c === ';' || /\s/.test(c) || c <= '\u001f' || c === '\u007f');

function isOrigin(value: string): boolean {
  if (hasUnsafeChar(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

const schema = z.object({
  MEDIA_ORIGIN: z.string().refine(isOrigin, MEDIA_ORIGIN_MESSAGE).optional(),
  APP_ENV: z.enum(['local', 'test', 'production']).default('local'),
});

function originOf(value: string | undefined): string | null {
  if (!value || hasUnsafeChar(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Reads MEDIA_ORIGIN, S3_ENDPOINT and APP_ENV; throws when MEDIA_ORIGIN is not a bare http(s) origin. */
export function readSecurityConfig(source: Record<string, string | undefined>): SecurityConfig {
  const mediaOrigin = source.MEDIA_ORIGIN === '' ? undefined : source.MEDIA_ORIGIN;
  const result = schema.safeParse({ MEDIA_ORIGIN: mediaOrigin, APP_ENV: source.APP_ENV });
  if (!result.success) {
    if (result.error.issues.some((i) => i.path[0] === 'MEDIA_ORIGIN')) {
      throw new Error(MEDIA_ORIGIN_MESSAGE);
    }
    throw new Error('環境変数の設定が不正です: APP_ENV');
  }
  return {
    mediaOrigin: result.data.MEDIA_ORIGIN ?? null,
    uploadOrigin: originOf(source.S3_ENDPOINT),
    production: result.data.APP_ENV === 'production',
  };
}
