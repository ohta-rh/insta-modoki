// Creates the hashtags of posts that were made before tags were stored, in the slot's D1:
// `node scripts/backfill-hashtags.ts` (bindings from wrangler's getPlatformProxy: the slot's
// .wrangler/state and .dev.vars). Safe to run again. Exit codes: 0 ok, 1 failure.
import { registerHooks } from 'node:module';
import { getPlatformProxy } from 'wrangler';

// The app's source imports without file extensions (the bundler resolves them); node does not.
// This hook adds `.ts` / `/index.ts` to a relative import that does not resolve as written.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.')) throw error;
      for (const suffix of ['.ts', '/index.ts']) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try the next form
        }
      }
      throw error;
    }
  },
});

let code = 0;
const proxy = await getPlatformProxy<{ DB: never }>();
try {
  const { getDb } = await import('../src/shared/db/client.ts');
  const { backfillHashtags } = await import('../src/features/hashtag/api/backfill-hashtags.ts');
  const { posts, links } = await backfillHashtags(getDb({ DB: proxy.env.DB }), {});
  console.log(`backfill-hashtags: OK posts=${posts} links=${links}`);
} catch (error) {
  console.error(
    `backfill-hashtags: 失敗しました: ${error instanceof Error ? error.message : String(error)}`,
  );
  code = 1;
} finally {
  await proxy.dispose();
}
process.exit(code);
