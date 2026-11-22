import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AwsClient } from 'aws4fetch';

// The app under test and these helpers share one slot: its bucket and key come from .dev.vars.
type Settings = { endpoint: string; bucket: string; aws: AwsClient; mediaBase: string };

function settings(): Settings {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(join(process.cwd(), '.dev.vars'), 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) vars[line.slice(0, i)] = line.slice(i + 1);
  }
  return {
    endpoint: vars.S3_ENDPOINT!.replace(/\/+$/, ''),
    bucket: vars.S3_BUCKET!,
    mediaBase: vars.S3_PUBLIC_BASE_URL!.replace(/\/+$/, ''),
    aws: new AwsClient({
      accessKeyId: vars.S3_ACCESS_KEY!,
      secretAccessKey: vars.S3_SECRET_KEY!,
      region: vars.S3_REGION || 'auto',
      service: 's3',
    }),
  };
}

/** The bytes and content type of a stored object, or null when it is absent. */
export async function getObject(
  key: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const { endpoint, bucket, aws } = settings();
  const res = await aws.fetch(`${endpoint}/${bucket}/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${key}: ${res.status}`);
  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? '',
  };
}

/** Where a browser reads an object from: the slot's public media origin, the same URL the app renders. */
export const mediaUrl = (key: string): string => `${settings().mediaBase}/${key}`;

/** Stores an object under the key (a few bytes unless a body is given; WebP unless a type is given). */
export async function putObject(
  key: string,
  body: BodyInit = new Uint8Array(5),
  contentType = 'image/webp',
): Promise<void> {
  const { endpoint, bucket, aws } = settings();
  const res = await aws.fetch(`${endpoint}/${bucket}/${key}`, {
    method: 'PUT',
    body,
    headers: { 'content-type': contentType },
  });
  if (!res.ok) throw new Error(`PUT ${key}: ${res.status}`);
}
