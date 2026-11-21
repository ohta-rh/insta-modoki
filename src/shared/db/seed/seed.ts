import { hashPassword } from '../../../features/auth/model/password.ts';
import type { StorageEnv } from '../../storage/client.ts';
import { newId } from '../id.ts';
import { generateDataset, SEED } from './generate.ts';
import { generateImage } from './images.ts';
import { PROFILES, type Profile, type ProfileName } from './profiles.ts';
import { createStore, type Store } from './store.ts';

// The seed runs in Node through `node scripts/seed/index.ts` with wrangler's getPlatformProxy
// bindings, so it uses the D1 binding directly (the app's drizzle modules import each other
// without extensions, which Node cannot load) and writes literal SQL: D1 allows only 100 bound
// variables per statement.

type D1Statement = {
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
};
export type SeedD1 = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};
export type SeedEnv = StorageEnv & {
  DB: SeedD1;
  AUTH_PEPPER: string;
  APP_ENV?: string;
  SLOT?: string;
};
export type SeedDeps = {
  env: SeedEnv;
  /** Process environment values (`SEED_DEMO_PASSWORD`, `APP_ENV`). */
  vars: Record<string, string | undefined>;
  log: (line: string) => void;
  /** Tests override the profiles and the storage. */
  profiles?: Record<string, Profile>;
  store?: Store;
};

const SEED_EMAIL_SUFFIX = '@seed.invalid';
const INSERT_ROWS = 500;
// D1 rejects a statement over 100 KB; the size is counted in UTF-8 bytes.
const INSERT_BYTES = 80_000;
const BATCH_STATEMENTS = 20;
const VARIANTS = ['orig', 'w320', 'w640', 'w1080'] as const;
const IMAGE_CONCURRENCY = 8;
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function parseArgs(argv: string[]): ProfileName | null {
  if (argv.length !== 2 || argv[0] !== '--profile') return null;
  return argv[1] === 'demo' || argv[1] === 'bench' ? argv[1] : null;
}

/** `SEED_DEMO_PASSWORD`, or a 16-character random one printed once (never kept in the repository). */
export function resolveDemoPassword(
  vars: Record<string, string | undefined>,
  log: (line: string) => void,
): string {
  if (vars.SEED_DEMO_PASSWORD) return vars.SEED_DEMO_PASSWORD;
  let password = '';
  while (password.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < 248 && password.length < 16) password += PASSWORD_ALPHABET[b % 62];
    }
  }
  log(`seed: demo のパスワード ${password}（この 1 回だけ表示します）`);
  return password;
}

type Cell = string | number | null;
const lit = (v: Cell): string =>
  v === null
    ? 'NULL'
    : typeof v === 'number'
      ? String(Math.trunc(v))
      : `'${v.replaceAll("'", "''")}'`;

function insertStatements(
  d1: SeedD1,
  table: string,
  columns: string[],
  rows: Cell[][],
): D1Statement[] {
  const statements: D1Statement[] = [];
  let chunk: string[] = [];
  let chars = 0;
  const flush = () => {
    if (chunk.length === 0) return;
    statements.push(
      d1.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.join(', ')}`),
    );
    chunk = [];
    chars = 0;
  };
  for (const row of rows) {
    const values = `(${row.map(lit).join(', ')})`;
    chunk.push(values);
    chars += Buffer.byteLength(values);
    if (chunk.length >= INSERT_ROWS || chars >= INSERT_BYTES) flush();
  }
  flush();
  return statements;
}

async function runBatches(d1: SeedD1, statements: D1Statement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH_STATEMENTS) {
    await d1.batch(statements.slice(i, i + BATCH_STATEMENTS));
  }
}

async function count(d1: SeedD1, sql: string): Promise<number> {
  return (await d1.prepare(sql).first<{ n: number }>())?.n ?? 0;
}

const SEED_USERS = `SELECT id FROM users WHERE substr(email, -${SEED_EMAIL_SUFFIX.length}) = '${SEED_EMAIL_SUFFIX}'`;

/** Removes the earlier seed: its users (rows cascade) and only the storage keys of their posts. */
async function cleanup(d1: SeedD1, store: Store): Promise<void> {
  const keys = (
    await d1
      .prepare(
        `SELECT DISTINCT m.storage_key AS k FROM media m JOIN posts p ON p.id = m.post_id WHERE p.author_id IN (${SEED_USERS})`,
      )
      .all<{ k: string }>()
  ).results.map((r) => r.k);
  await d1.prepare(`DELETE FROM users WHERE id IN (${SEED_USERS})`).run();
  await store.remove(keys.flatMap((k) => VARIANTS.map((n) => `${k}/${n}.webp`)));
}

export async function runSeed(argv: string[], deps: SeedDeps): Promise<number> {
  const { env, vars, log } = deps;
  const name = parseArgs(argv);
  if (name === null) {
    log('使い方: node scripts/seed/index.ts --profile demo|bench');
    return 2;
  }
  if ((vars.APP_ENV ?? env.APP_ENV) === 'production') {
    log('本番の DB にはシードを入れません');
    return 1;
  }
  const bucketSlot = /^insta-s(\d+)$/.exec(env.S3_BUCKET ?? '')?.[1];
  if (bucketSlot === undefined) {
    log(`スロットのバケット（insta-s<N>）ではないので入れません: ${env.S3_BUCKET}`);
    return 1;
  }
  if (env.SLOT !== bucketSlot) {
    log(
      `バケット ${env.S3_BUCKET} の番号が .dev.vars の SLOT（${env.SLOT ?? '未設定'}）と違うので入れません`,
    );
    return 1;
  }
  const profile = (deps.profiles ?? PROFILES)[name]!;
  const d1 = env.DB;
  const store = deps.store ?? createStore(env);
  const password = resolveDemoPassword(vars, log);

  await cleanup(d1, store);

  const data = generateDataset(profile, SEED);
  const userIds = data.users.map(() => newId());
  const postIds = data.posts.map(() => newId());

  // media.storage_key is UNIQUE, so every media row has its own key under its post's author. The
  // first row of an image holds the uploaded files; a pooled image's later rows get server-side copies.
  const keyOf = new Array<string>(data.imageCount);
  const rowKeys: string[] = [];
  const copies: [string, string][] = [];
  for (const m of data.media) {
    const owner = userIds[data.posts[m.postIndex]!.authorIndex]!;
    const key = `media/${owner}/${newId()}`;
    rowKeys.push(key);
    if (keyOf[m.imageIndex] === undefined) keyOf[m.imageIndex] = key;
    else
      for (const n of VARIANTS)
        copies.push([`${keyOf[m.imageIndex]}/${n}.webp`, `${key}/${n}.webp`]);
  }

  const images = new Array<Awaited<ReturnType<typeof generateImage>>>(data.imageCount);
  for (let i = 0; i < data.imageCount; i += IMAGE_CONCURRENCY) {
    const indexes = Array.from(
      { length: Math.min(IMAGE_CONCURRENCY, data.imageCount - i) },
      (_, k) => i + k,
    );
    await Promise.all(
      indexes.map(async (index) => {
        const image = await generateImage(SEED + index);
        images[index] = image;
        const base = keyOf[index]!;
        await Promise.all([
          store.put(`${base}/orig.webp`, image.orig, 'image/webp'),
          store.put(`${base}/w320.webp`, image.w320, 'image/webp'),
          store.put(`${base}/w640.webp`, image.w640, 'image/webp'),
          store.put(`${base}/w1080.webp`, image.w1080, 'image/webp'),
        ]);
      }),
    );
  }

  await store.copy(copies);

  const demoHash = await hashPassword(password, env.AUTH_PEPPER);
  const now = Date.now();
  await runBatches(d1, [
    ...insertStatements(
      d1,
      'users',
      ['id', 'username', 'display_name', 'bio', 'email', 'created_at', 'updated_at'],
      data.users.map((u, i) => [
        userIds[i]!,
        u.username,
        u.displayName,
        u.bio,
        u.email,
        u.createdAt,
        u.createdAt,
      ]),
    ),
    ...insertStatements(
      d1,
      'accounts',
      ['id', 'account_id', 'provider_id', 'user_id', 'password', 'created_at', 'updated_at'],
      [[newId(), userIds[0]!, 'credential', userIds[0]!, demoHash, now, now]],
    ),
    ...insertStatements(
      d1,
      'posts',
      ['id', 'author_id', 'caption', 'created_at'],
      data.posts.map((p, i) => [postIds[i]!, userIds[p.authorIndex]!, p.caption, p.createdAt]),
    ),
    ...insertStatements(
      d1,
      'media',
      [
        'id',
        'post_id',
        'position',
        'type',
        'storage_key',
        'width',
        'height',
        'alt_text',
        'thumbhash',
      ],
      data.media.map((m, i) => {
        const image = images[m.imageIndex]!;
        return [
          newId(),
          postIds[m.postIndex]!,
          m.position,
          'image',
          rowKeys[i]!,
          image.width,
          image.height,
          image.altText,
          image.thumbhash,
        ];
      }),
    ),
    ...insertStatements(
      d1,
      'likes',
      ['user_id', 'post_id', 'created_at'],
      data.likes.map((l) => [userIds[l.userIndex]!, postIds[l.postIndex]!, l.createdAt]),
    ),
  ]);

  const commentIds = data.comments.map(() => newId());
  await runBatches(d1, [
    ...insertStatements(
      d1,
      'comments',
      ['id', 'post_id', 'author_id', 'parent_id', 'body', 'created_at'],
      data.comments.map((c, i) => [
        commentIds[i]!,
        postIds[c.postIndex]!,
        userIds[c.authorIndex]!,
        c.parentIndex === null ? null : commentIds[c.parentIndex]!,
        c.body,
        c.createdAt,
      ]),
    ),
    ...insertStatements(
      d1,
      'follows',
      ['follower_id', 'followee_id', 'created_at'],
      data.follows.map((f) => [userIds[f.followerIndex]!, userIds[f.followeeIndex]!, f.createdAt]),
    ),
  ]);

  // The counts are written once, after every row is in.
  await d1
    .prepare(
      `UPDATE posts SET like_count = (SELECT count(*) FROM likes l WHERE l.post_id = posts.id), comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = posts.id) WHERE author_id IN (${SEED_USERS})`,
    )
    .run();

  const users = await count(d1, `SELECT count(*) AS n FROM users WHERE id IN (${SEED_USERS})`);
  const posts = await count(
    d1,
    `SELECT count(*) AS n FROM posts WHERE author_id IN (${SEED_USERS})`,
  );
  const media = await count(
    d1,
    `SELECT count(*) AS n FROM media WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${SEED_USERS}))`,
  );
  if (users !== profile.users || posts !== profile.posts) {
    log(`seed: FAIL users=${users} posts=${posts}`);
    return 1;
  }
  log(`seed: ${name} OK users=${users} posts=${posts}${name === 'demo' ? ` media=${media}` : ''}`);
  return 0;
}
