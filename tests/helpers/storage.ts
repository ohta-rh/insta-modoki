import { getPlatformProxy } from 'wrangler';
import { getStorageClient, objectUrl, type StorageEnv } from '../../src/shared/storage/client';

/** The slot's storage settings, read the way wrangler reads `.dev.vars`. */
export async function loadStorageEnv(): Promise<StorageEnv> {
  const proxy = await getPlatformProxy<StorageEnv>({ persist: false });
  try {
    const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_BASE_URL } =
      proxy.env;
    return { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_BASE_URL };
  } finally {
    await proxy.dispose();
  }
}

/** HEAD an object with the slot's own key: its size and content type, or null when absent. */
export async function headObject(
  env: StorageEnv,
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  const client = getStorageClient(env);
  const res = await client.aws.fetch(objectUrl(client, key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${key}: ${res.status}`);
  return {
    size: Number(res.headers.get('content-length')),
    contentType: res.headers.get('content-type') ?? '',
  };
}
