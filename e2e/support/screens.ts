import { test as base, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { baseURL, signUpViaUi, type NewUser } from './auth';
import { seedFollow, seedUser, userRow } from './db';
import { waitForHydration } from './hydration';
import { insertPost, putPostFiles } from './posts';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/** What the accessibility specs look at: a signed-in viewer who follows an author with three posts. */
export type World = {
  viewer: NewUser;
  state: StorageState;
  author: string;
  /** Three photos, the first with an alt text, the other two without. */
  detailPostId: string;
  /** Only the like test presses the heart of this one. */
  likePostId: string;
  /** Only the likers' list test likes this one. */
  likersPostId: string;
};

export type Screen = {
  name: string;
  path: (world: World) => string;
  loggedIn: boolean;
};

/** The eight main screens (375px wide in the specs). */
export const SCREENS: Screen[] = [
  { name: 'サインアップ', path: () => '/accounts/signup', loggedIn: false },
  { name: 'ログイン', path: () => '/accounts/login', loggedIn: false },
  { name: 'ホームフィード', path: () => '/', loggedIn: true },
  { name: 'プロフィール', path: (w) => `/${w.author}`, loggedIn: true },
  { name: 'プロフィールの編集', path: () => '/accounts/edit', loggedIn: true },
  { name: '投稿の作成', path: () => '/create', loggedIn: true },
  { name: '投稿詳細', path: (w) => `/p/${w.detailPostId}`, loggedIn: true },
  { name: 'フォロワーの一覧', path: (w) => `/${w.author}/followers`, loggedIn: true },
];

/** Signs a viewer up and gives an author they follow three posts with real photo files. */
async function createWorld(browser: Browser): Promise<World> {
  const context = await browser.newContext({ baseURL: baseURL() });
  const page = await context.newPage();
  const viewer = await signUpViaUi(page);
  const state = await context.storageState();

  const author = `e2e_x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(author, `${author}@example.com`, { displayName: '見本の人' });
  seedFollow(userRow(viewer.username)!.id as string, userRow(author)!.id as string);
  const detail = insertPost({
    authorUsername: author,
    caption: 'アクセシビリティの試験',
    mediaCount: 3,
    altTexts: ['猫', '', ''],
  });
  const like = insertPost({ authorUsername: author, caption: 'いいねの試験' });
  const likers = insertPost({ authorUsername: author, caption: 'いいねした人の試験' });
  for (const post of [detail, like, likers]) await putPostFiles(page, post);
  await context.close();
  return {
    viewer,
    state,
    author,
    detailPostId: detail.id,
    likePostId: like.id,
    likersPostId: likers.id,
  };
}

/** `test` with the worker's `world`; every spec of the worker shares it. */
export const test = base.extend<object, { world: World }>({
  world: [
    async ({ browser }, use) => {
      await use(await createWorld(browser));
    },
    { scope: 'worker' },
  ],
});

/** A fresh context (signed in, or not) of the given size, with its page. */
export async function newScreenPage(
  browser: Browser,
  options: {
    world: World;
    loggedIn: boolean;
    width: number;
    height?: number;
    reducedMotion?: 'reduce' | 'no-preference';
  },
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: baseURL(),
    viewport: { width: options.width, height: options.height ?? 812 },
    storageState: options.loggedIn ? options.world.state : undefined,
    reducedMotion: options.reducedMotion,
  });
  return context.newPage();
}

/** Opens `path` and waits until the page has a main region and React has hydrated it. */
export async function openSettled(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole('main').waitFor();
  await waitForHydration(page);
}
