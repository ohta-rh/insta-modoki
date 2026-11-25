import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CommentView } from '../model/schema';
import { failSubmit, initThread, startSubmit } from '../model/thread';
import { CommentForm } from './CommentForm';

const REQUEST_ID = '0198a0f0-0000-7000-8000-000000000002';
const noop = () => {};
const render = (props: Partial<Parameters<typeof CommentForm>[0]> = {}) =>
  renderToStaticMarkup(
    <CommentForm
      postId="0198a0f0-0000-7000-8000-000000000001"
      requestId={REQUEST_ID}
      draft=""
      replyTo={null}
      error={null}
      ready={false}
      onDraftChange={noop}
      onSubmit={noop}
      onCancelReply={noop}
      {...props}
    />,
  );

const temp: CommentView = {
  id: 'tmp-1',
  author: { username: 'haru', displayName: 'haru', avatarUrl: null },
  body: '本文',
  parentId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  canDelete: true,
};

describe('CommentForm', () => {
  it('失敗したとき行を取り消し本文を残して message を出す', () => {
    const sent = startSubmit(
      { ...initThread({ items: [], nextCursor: null }), draft: '本文' },
      temp,
      null,
    );
    expect(sent.items).toHaveLength(1);
    const failed = failSubmit(
      sent,
      'tmp-1',
      null,
      { draft: '本文', replyTo: null },
      '操作が多すぎます。しばらくしてからもう一度お試しください',
    );
    expect(failed.items).toHaveLength(0);
    const html = render({ draft: failed.draft, error: failed.error });
    expect(html).toContain('value="本文"');
    expect(html).toMatch(
      /role="alert"[^>]*>操作が多すぎます。しばらくしてからもう一度お試しください</,
    );
  });

  it('入力欄に「コメントを追加」のラベルがあり 送信ボタンに名前がある', () => {
    const html = render();
    expect(html).toMatch(/<label[^>]*for="comment-input"[^>]*>コメントを追加<\/label>/);
    expect(html).toContain('id="comment-input"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>投稿<\/button>/);
  });

  it('JS が読み込まれる前は送信ボタンを押せ 読み込み後は空のとき押せない', () => {
    const disabled = (html: string) => /<button[^>]*type="submit"[^>]*disabled=""/.test(html);
    expect(disabled(render({ ready: false }))).toBe(false);
    expect(disabled(render({ ready: true, draft: '  ' }))).toBe(true);
    expect(disabled(render({ ready: true, draft: 'こんにちは' }))).toBe(false);
  });

  it('JS が無くても送れるよう 入力は必須で 投稿の ID と送信 ID を隠しの項目に持つ', () => {
    const html = render({ replyTo: { rootId: 'p1', parentId: 'r1', username: 'ken' } });
    expect(html).toContain('name="body"');
    expect(html).toContain('required');
    expect(html).toContain('name="postId" value="0198a0f0-0000-7000-8000-000000000001"');
    expect(html).toContain(`name="clientRequestId" value="${REQUEST_ID}"`);
    expect(html).toContain('name="parentId" value="r1"');
    expect(render()).not.toContain('name="parentId"');
  });

  it('返信先があるとき「@ken に返信中」と取り消しを出す', () => {
    const html = render({ replyTo: { rootId: 'p1', parentId: 'r1', username: 'ken' } });
    expect(html).toContain('@ken に返信中');
    expect(html).toMatch(/<button[^>]*>返信をやめる<\/button>/);
    expect(render()).not.toContain('返信中');
  });

  it('2,000 字以上で「n / 2,200」を出す', () => {
    expect(render({ draft: 'あ'.repeat(1999) })).not.toContain('/ 2,200');
    expect(render({ draft: 'あ'.repeat(2000) })).toContain('2000 / 2,200');
    expect(render({ draft: '😀'.repeat(2201) })).toContain('2201 / 2,200');
  });
});
