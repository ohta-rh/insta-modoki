import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoryTrayView } from '../api/list-story-tray';
import { StoryTraySection } from './StoryTraySection';

afterEach(() => vi.restoreAllMocks());

describe('StoryTraySection', () => {
  it('取得が成功したときはトレイを描く', async () => {
    const view: StoryTrayView = {
      me: { username: 'me', displayName: 'me', avatarUrl: null },
      hasOwn: false,
      items: [
        {
          user: { username: 'bob', displayName: 'bob', avatarUrl: null },
          hasUnseen: true,
          latestAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const html = renderToStaticMarkup(await StoryTraySection({ load: async () => view }));
    expect(html).toContain('href="/stories/bob"');
  });

  it('取得が失敗したときは追加ボタンだけを描き、例外を外へ出さない', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new TypeError('secret sql detail');
    const html = renderToStaticMarkup(
      await StoryTraySection({
        load: async () => {
          throw boom;
        },
      }),
    );
    expect(html).toContain('>ストーリーを追加<');
    expect(html).not.toContain('/stories/bob');
    expect(log).toHaveBeenCalledWith('listStoryTray failed', 'TypeError');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });
});
