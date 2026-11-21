import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AwsClient } from 'aws4fetch';

// The app under test and these helpers share one slot: its bucket and key come from .dev.vars.
type Settings = { endpoint: string; bucket: string; aws: AwsClient };

function settings(): Settings {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(join(process.cwd(), '.dev.vars'), 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) vars[line.slice(0, i)] = line.slice(i + 1);
  }
  return {
    endpoint: vars.S3_ENDPOINT!.replace(/\/+$/, ''),
    bucket: vars.S3_BUCKET!,
    aws: new AwsClient({
      accessKeyId: vars.S3_ACCESS_KEY!,
      secretAccessKey: vars.S3_SECRET_KEY!,
      region: vars.S3_REGION || 'auto',
      service: 's3',
    }),
  };
}

/**
 * The browser PUTs straight to the bucket from another origin, so the bucket must allow it (CORS).
 * Idempotent; R2 gets the same rule in M2.
 */
export async function ensureBucketCors(): Promise<void> {
  const { endpoint, bucket, aws } = settings();
  const body =
    '<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>PUT</AllowedMethod>' +
    '<AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader>' +
    '<ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3000</MaxAgeSeconds></CORSRule></CORSConfiguration>';
  const res = await aws.fetch(`${endpoint}/${bucket}?cors`, {
    method: 'PUT',
    body,
    headers: { 'content-type': 'application/xml' },
  });
  if (!res.ok) throw new Error(`CORS を設定できませんでした: ${res.status} ${await res.text()}`);
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
