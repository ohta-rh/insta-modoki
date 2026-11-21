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

/** PUT an object with the slot's own key (the way a presigned PUT would store it). */
export async function putObject(
  env: StorageEnv,
  key: string,
  body: Uint8Array<ArrayBuffer>,
  contentType = 'image/webp',
): Promise<void> {
  const client = getStorageClient(env);
  const res = await client.aws.fetch(objectUrl(client, key), {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) throw new Error(`PUT ${key}: ${res.status}`);
}

/** The four files `uploadImages` stores for one photo key. */
export async function putPhoto(env: StorageEnv, key: string): Promise<void> {
  for (const name of ['orig', 'w320', 'w640', 'w1080']) {
    await putObject(env, `${key}/${name}.webp`, new Uint8Array([82, 73, 70, 70]));
  }
}
