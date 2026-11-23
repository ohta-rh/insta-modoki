import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../../../shared/action';
import { initList, loadMore } from '../model/load-more';
import type { NotificationPage, NotificationView } from '../model/schema';
import { NotificationListView } from './NotificationList';

const NOW = Date.UTC(2026, 10, 1);
const row = (id: string): NotificationView => ({
  id,
  type: 'follow',
  actor: { username: 'haru', displayName: 'はる', avatarUrl: null },
  post: null,
  comment: null,
  read: true,
  createdAt: new Date(NOW).toISOString(),
});
const ok = (
  items: NotificationView[],
  nextCursor: string | null,
): ActionResult<NotificationPage> => ({
  ok: true,
  data: { items, nextCursor },
});

describe('NotificationList', () => {
  it('さらに表示で続きを足し、失敗は alert で出す', async () => {
    let state = initList({ items: [row('a')], nextCursor: 'c1' });
    expect(renderToStaticMarkup(<NotificationListView state={state} now={NOW} />)).toContain(
      'さらに表示',
    );

    // A failure keeps the rows and the button and says why.
    const failed = await loadMore(state, async () => ({
      ok: false,
      error: { code: 'RATE_LIMITED', message: '操作が多すぎます' },
    }));
    const failedHtml = renderToStaticMarkup(<NotificationListView state={failed} now={NOW} />);
    expect(failedHtml).toContain('<p role="alert"');
    expect(failedHtml).toContain('操作が多すぎます');
    expect(failedHtml).toContain('さらに表示');
    expect(failed.items).toHaveLength(1);

    // A thrown error is the generic message.
    const thrown = await loadMore(state, async () => {
      throw new Error('offline');
    });
    expect(thrown.error).toContain('エラーが発生しました');

    // A retry appends the next 20 and, on the last page, the button goes away.
    const seen: string[] = [];
    state = await loadMore(failed, async (cursor) => {
      seen.push(cursor);
      return ok([row('b'), row('c')], null);
    });
    expect(seen).toEqual(['c1']);
    expect(state.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    const done = renderToStaticMarkup(<NotificationListView state={state} now={NOW} />);
    expect(done).not.toContain('さらに表示');
    expect(done).not.toContain('role="alert"');
  });

  it('0 件のときは「まだ通知はありません」', () => {
    const html = renderToStaticMarkup(
      <NotificationListView state={initList({ items: [], nextCursor: null })} now={NOW} />,
    );
    expect(html).toContain('まだ通知はありません');
  });

  it('期間ごとに h3 の見出しと一覧で区切り、通知の無い期間は出さない', () => {
    const DAY = 24 * 3_600_000;
    const at = (id: string, ms: number): NotificationView => ({
      ...row(id),
      createdAt: new Date(ms).toISOString(),
    });
    const html = renderToStaticMarkup(
      <NotificationListView
        state={initList({
          items: [at('a', NOW), at('b', NOW - 3 * DAY), at('c', NOW - 40 * DAY)],
          nextCursor: null,
        })}
        now={NOW}
      />,
    );
    const headings = [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    expect(headings).toEqual(['今日', '今週', 'それ以前']);
    expect(html).not.toContain('今月');
    expect(html.match(/<section /g)).toHaveLength(3);
    expect(html).toContain('aria-label="通知の一覧"');
  });
});
