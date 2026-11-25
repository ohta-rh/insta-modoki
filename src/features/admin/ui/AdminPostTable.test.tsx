import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../../../shared/action';
import { createDeleteController } from '../model/delete-controller';
import type { AdminPostRow } from '../model/schema';

const row = (id: string, authorUsername: string): AdminPostRow => ({
  id,
  authorUsername,
  captionExcerpt: `caption of ${id}`,
  createdAt: new Date(0),
});

const make = (remove: (key: string) => Promise<ActionResult<{ deleted: true }>>) =>
  createDeleteController<AdminPostRow>({
    rows: [row('p1', 'haru'), row('p2', 'aki')],
    keyOf: (r) => r.id,
    labelOf: (r) => `${r.authorUsername} の投稿`,
    remove,
    fallbackMessage: 'エラーが発生しました。しばらくしてからもう一度お試しください',
    onChange: () => {},
  });

describe('AdminPostTable', () => {
  it('削除が失敗したとき行を残して message を出す', async () => {
    const message = '操作が多すぎます。しばらくしてからもう一度お試しください';
    const c = make(async () => ({ ok: false, error: { code: 'RATE_LIMITED', message } }));
    c.ask('p1');
    await c.confirm();
    expect(c.snapshot().rows.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(c.snapshot()).toMatchObject({ error: message, target: null, busy: false });
  });

  it('通信が失敗したとき（例外）も行を残して決まった message を出す', async () => {
    const c = make(async () => {
      throw new Error('network');
    });
    c.ask('p2');
    await c.confirm();
    expect(c.snapshot().rows).toHaveLength(2);
    expect(c.snapshot().error).toBe('エラーが発生しました。しばらくしてからもう一度お試しください');
  });

  it('成功したとき行が消え、取り消したときは残る', async () => {
    const calls: string[] = [];
    const c = make(async (key) => {
      calls.push(key);
      return { ok: true, data: { deleted: true } };
    });
    c.ask('p1');
    c.cancel();
    expect(c.snapshot()).toMatchObject({ target: null });
    expect(calls).toEqual([]);
    expect(c.snapshot().rows).toHaveLength(2);

    c.ask('p1');
    await c.confirm();
    expect(calls).toEqual(['p1']);
    expect(c.snapshot().rows.map((r) => r.id)).toEqual(['p2']);
    expect(c.snapshot().notice).toBe('haru の投稿 を削除しました');
  });

  it('実行中の 2 回目の確認は送らない', async () => {
    const pending: Array<() => void> = [];
    let calls = 0;
    const c = make(
      () =>
        new Promise((resolve) => {
          calls += 1;
          pending.push(() => resolve({ ok: true, data: { deleted: true } }));
        }),
    );
    c.ask('p1');
    const first = c.confirm();
    await c.confirm();
    pending[0]!();
    await first;
    expect(calls).toBe(1);
  });
});
