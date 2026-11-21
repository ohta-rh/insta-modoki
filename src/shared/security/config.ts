import { z } from 'zod';

export type SecurityConfig = { mediaOrigin: string | null; production: boolean };

const MEDIA_ORIGIN_MESSAGE = 'MEDIA_ORIGIN は origin（例 https://example.com）で指定してください';

// `;`, whitespace and control characters would let a value open a new CSP directive or header,
// so they are rejected before the value is parsed as a URL.
const UNSAFE_CHARS = /[;\s\u0000-\u001f\u007f]/;

function isOrigin(value: string): boolean {
  if (UNSAFE_CHARS.test(value)) return false;
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

/** Reads MEDIA_ORIGIN and APP_ENV; throws when MEDIA_ORIGIN is not a bare http(s) origin. */
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
    production: result.data.APP_ENV === 'production',
  };
}
