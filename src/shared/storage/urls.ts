import type { StorageEnv } from './client';

type UrlEnv = Pick<StorageEnv, 'S3_ENDPOINT' | 'S3_BUCKET'> & { S3_PUBLIC_BASE_URL?: string };

const trimSlash = (s: string): string => s.replace(/\/+$/, '');

/** The URL a visitor reads an object from (never signed; signing is only for writes). */
export function publicUrl(env: UrlEnv, key: string): string {
  const base = env.S3_PUBLIC_BASE_URL
    ? trimSlash(env.S3_PUBLIC_BASE_URL)
    : `${trimSlash(env.S3_ENDPOINT)}/${env.S3_BUCKET}`;
  return `${base}/${key}`;
}

/** The three delivery sizes of a `media.storage_key`, for an `<img srcset>`. */
export function mediaSrcset(
  env: UrlEnv,
  storageKey: string,
): { w320: string; w640: string; w1080: string } {
  return {
    w320: publicUrl(env, `${storageKey}/w320.webp`),
    w640: publicUrl(env, `${storageKey}/w640.webp`),
    w1080: publicUrl(env, `${storageKey}/w1080.webp`),
  };
}
