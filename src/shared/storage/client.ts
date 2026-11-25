import { AwsClient } from 'aws4fetch';

/** The S3-compatible storage settings: .dev.vars locally (Garage), secrets in production (R2). */
export type StorageEnv = {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET: string;
  /** Where visitors read objects from; when absent, `<S3_ENDPOINT>/<S3_BUCKET>`. */
  S3_PUBLIC_BASE_URL?: string;
};

export type StorageClient = {
  aws: AwsClient;
  /** `<endpoint>/<bucket>`, path style, no trailing slash. */
  bucketUrl: string;
};

const trimSlash = (s: string): string => s.replace(/\/+$/, '');

export function getStorageClient(env: StorageEnv): StorageClient {
  for (const name of ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'] as const) {
    if (!env[name]) throw new Error(`ストレージの設定がありません: ${name}`);
  }
  return {
    aws: new AwsClient({
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
      region: env.S3_REGION || 'auto',
      service: 's3',
    }),
    bucketUrl: `${trimSlash(env.S3_ENDPOINT)}/${env.S3_BUCKET}`,
  };
}

/** The URL of one object (path style); each key segment is escaped. */
export function objectUrl(client: StorageClient, key: string): string {
  return `${client.bucketUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
