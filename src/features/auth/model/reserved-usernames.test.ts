import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESERVED_USERNAMES, isReservedUsername } from './reserved-usernames';

const routesMd = readFileSync(
  new URL('../../../../docs/architecture/routes.md', import.meta.url),
  'utf8',
);

describe('RESERVED_USERNAMES', () => {
  it('routes.md の予約語が全て拒まれる', () => {
    const section = routesMd.split('### 予約したユーザー名')[1]!.split('##')[0]!;
    const words = [...section.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
    expect(words).toHaveLength(18);
    for (const w of words) expect(isReservedUsername(w), w).toBe(true);
    expect([...RESERVED_USERNAMES].sort()).toEqual([...words].sort());
  });

  it('予約語でない名前のとき false', () => {
    expect(isReservedUsername('haru')).toBe(false);
    expect(isReservedUsername('administrator')).toBe(false);
  });
});
