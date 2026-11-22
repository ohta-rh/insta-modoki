import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// zod's `Function('')` probe breaks the CSP on every screen the browser bundle reaches (the
// post-merge E2E run saw "script-src eval" on / after the badge pulled schema.ts in).
const CLIENT_FILES = [
  'ui/NotificationBadge.tsx',
  'ui/NotificationItem.tsx',
  'ui/NotificationList.tsx',
  'ui/unread-store.ts',
  'model/notification-text.ts',
  'model/load-more.ts',
  'model/constants.ts',
];

describe('通知のブラウザ側のコード', () => {
  it.each(CLIENT_FILES)('%s は zod にも schema.ts の値にも依らない', (file) => {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    expect(source).not.toMatch(/from 'zod'/);
    const valueImports = source.match(/^import (?!type)[^;]*from '[^']*schema';/gm) ?? [];
    expect(valueImports).toEqual([]);
  });
});
