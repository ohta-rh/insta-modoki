import { expect, test } from '@playwright/test';
import { signInViaHarness } from './support/auth';
import { getObject } from './support/storage';
import { insertStory, putStoryFiles, storyRows } from './support/stories';

const HOUR = 3_600_000;

test('日次の定期実行で期限切れのストーリーの行とファイルが消える', async ({ page, request }) => {
  const { username } = await signInViaHarness(page);
  // Made 25 hours ago, so it expired an hour ago.
  const story = insertStory({ authorUsername: username, createdAt: Date.now() - 25 * HOUR });
  const keys = await putStoryFiles(page, story);
  expect(keys).toHaveLength(4);
  expect(storyRows(username)).toHaveLength(1);
  for (const key of keys) expect(await getObject(key), key).not.toBeNull();

  const res = await request.get('/__scheduled?cron=0+18+*+*+*');
  expect(res.status()).toBe(200);

  await expect.poll(() => storyRows(username)).toHaveLength(0);
  for (const key of keys) expect(await getObject(key), key).toBeNull();
  expect((await request.get('/')).status()).toBe(200);
});
