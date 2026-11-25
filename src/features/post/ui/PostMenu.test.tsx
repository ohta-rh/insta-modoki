import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { copyPostLink, COPY_FAILED_MESSAGE, COPIED_MESSAGE } from '../model/copy-link';
import { PostMenu } from './PostMenu';

const ID = '0198a0f0-0000-7000-8000-000000000001';

describe('PostMenu', () => {
  it('コピーに成功したら 投稿の絶対 URL を書き 完了を知らせて閉じてよい', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await copyPostLink(ID, 'https://example.test', { writeText });
    expect(writeText).toHaveBeenCalledWith(`https://example.test/p/${ID}`);
    expect(result).toEqual({ ok: true, message: COPIED_MESSAGE });
    expect(COPIED_MESSAGE).toBe('リンクをコピーしました');
  });

  it('コピーに失敗したら知らせてメニューを閉じない', async () => {
    const refused = await copyPostLink(ID, 'https://example.test', {
      writeText: () => Promise.reject(new Error('denied')),
    });
    expect(refused).toEqual({ ok: false, message: COPY_FAILED_MESSAGE });
    expect(COPY_FAILED_MESSAGE).toBe('リンクをコピーできませんでした');
    const missing = await copyPostLink(ID, 'https://example.test', undefined);
    expect(missing).toEqual({ ok: false, message: COPY_FAILED_MESSAGE });
  });

  it('スクリプトの前でも開けるよう popovertarget で結び 3 つの行を持つ', () => {
    const html = renderToStaticMarkup(<PostMenu postId={ID} />);
    expect(html).toMatch(new RegExp(`popovertarget="post-menu-${ID}"`, 'i'));
    expect(html).toContain(`id="post-menu-${ID}"`);
    expect(html).toContain('popover="auto"');
    expect(html).toMatch(/aria-label="その他の操作"/);
    expect(html).toContain(`href="/p/${ID}"`);
    expect(html).toContain('投稿へ移動');
    expect(html).toContain('リンクをコピー');
    expect(html).toContain('キャンセル');
  });
});
