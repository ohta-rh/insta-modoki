import { describe, expect, it } from 'vitest';
import type { CommentView } from './schema';
import {
  appendParents,
  appendReplies,
  failSubmit,
  finishSubmit,
  hasMoreReplies,
  initThread,
  removeComment,
  startSubmit,
} from './thread';

const author = { username: 'haru', displayName: 'Haru', avatarUrl: null };
const view = (id: string, over: Partial<CommentView> = {}): CommentView => ({
  id,
  author,
  body: id,
  parentId: null,
  createdAt: `2026-11-01T00:00:${id.slice(1).padStart(2, '0')}.000Z`,
  canDelete: true,
  ...over,
});
const parent = (id: string, replies: CommentView[] = [], replyCount = replies.length) =>
  view(id, { replies, replyCount });
const reply = (id: string, parentId: string) => view(id, { parentId });
const ids = (s: { items: CommentView[] }) => s.items.map((c) => c.id);

describe('thread', () => {
  it('送信を始めると一時の行が末尾に付き 入力欄が空になる', () => {
    const s0 = initThread({ items: [parent('p1')], nextCursor: 'next' });
    const s1 = startSubmit(
      { ...s0, draft: 'こんにちは' },
      view('tmp-1', { body: 'こんにちは' }),
      null,
    );
    expect(ids(s1)).toEqual(['p1', 'tmp-1']);
    expect(s1).toMatchObject({ draft: '', replyTo: null, error: null, nextCursor: 'next' });
  });

  it('返信の送信は親の replies の末尾に付き replyCount が 1 増える', () => {
    const s0 = initThread({ items: [parent('p1', [reply('r1', 'p1')], 4)], nextCursor: null });
    const s1 = startSubmit(s0, reply('tmp-1', 'p1'), 'p1');
    expect(s1.items[0]!.replies!.map((r) => r.id)).toEqual(['r1', 'tmp-1']);
    expect(s1.items[0]!.replyCount).toBe(5);
  });

  it('成功すると一時の行をサーバーの行に置き換える', () => {
    const s0 = startSubmit(initThread({ items: [], nextCursor: null }), view('tmp-1'), null);
    const s1 = finishSubmit(s0, 'tmp-1', parent('p9'), null);
    expect(ids(s1)).toEqual(['p9']);
    const s2 = startSubmit(
      initThread({ items: [parent('p1')], nextCursor: null }),
      reply('tmp-2', 'p1'),
      'p1',
    );
    const s3 = finishSubmit(s2, 'tmp-2', reply('r9', 'p1'), 'p1');
    expect(s3.items[0]!.replies!.map((r) => r.id)).toEqual(['r9']);
  });

  it('失敗したとき 一時の行を取り除き 本文と返信先を戻して message を持つ', () => {
    const target = { rootId: 'p1', parentId: 'p1', username: 'ken' };
    const s0 = initThread({ items: [parent('p1')], nextCursor: null });
    const s1 = startSubmit({ ...s0, draft: '本文', replyTo: target }, reply('tmp-1', 'p1'), 'p1');
    const s2 = failSubmit(
      s1,
      'tmp-1',
      'p1',
      { draft: '本文', replyTo: target },
      '操作が多すぎます',
    );
    expect(s2.items[0]!.replies).toEqual([]);
    expect(s2.items[0]!.replyCount).toBe(0);
    expect(s2).toMatchObject({ draft: '本文', replyTo: target, error: '操作が多すぎます' });
    const t1 = startSubmit(s0, view('tmp-2'), null);
    expect(ids(failSubmit(t1, 'tmp-2', null, { draft: 'x', replyTo: null }, 'm'))).toEqual(['p1']);
  });

  it('失敗の後に新しく入力した本文は上書きしない', () => {
    const s0 = startSubmit(initThread({ items: [], nextCursor: null }), view('tmp-1'), null);
    const typed = { ...s0, draft: '次の本文' };
    expect(failSubmit(typed, 'tmp-1', null, { draft: '前の本文', replyTo: null }, 'm').draft).toBe(
      '次の本文',
    );
  });

  it('続きを読むと id で重複を除き 古い順に並べる', () => {
    const s0 = initThread({ items: [parent('p1'), parent('p2'), view('p5')], nextCursor: 'c' });
    const s1 = appendParents(s0, {
      items: [parent('p3'), parent('p4'), view('p5')],
      nextCursor: null,
    });
    expect(ids(s1)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(s1.nextCursor).toBeNull();
  });

  it('返信を読み込むと 最初の 3 件と重ならず カーソルを覚える', () => {
    const three = [reply('r1', 'p1'), reply('r2', 'p1'), reply('r3', 'p1')];
    const s0 = initThread({ items: [parent('p1', three, 25)], nextCursor: null });
    expect(hasMoreReplies(s0, s0.items[0]!)).toBe(true);
    const s1 = appendReplies(s0, 'p1', {
      items: [...three, reply('r4', 'p1')],
      nextCursor: 'rc',
    });
    expect(s1.items[0]!.replies!.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(s1.replyCursors).toEqual({ p1: 'rc' });
    expect(hasMoreReplies(s1, s1.items[0]!)).toBe(true);
    const s2 = appendReplies(s1, 'p1', { items: [reply('r5', 'p1')], nextCursor: null });
    expect(s2.replyCursors).toEqual({ p1: null });
    expect(hasMoreReplies(s2, s2.items[0]!)).toBe(false);
  });

  it('返信が 3 件以下の親は続きを持たない', () => {
    const s = initThread({ items: [parent('p1', [reply('r1', 'p1')], 1)], nextCursor: null });
    expect(hasMoreReplies(s, s.items[0]!)).toBe(false);
  });

  it('親を消すと返信ごと消え 消えた件数は replyCount を含む 返信だけなら 1', () => {
    const s0 = initThread({
      items: [parent('p1', [reply('r1', 'p1')], 4), parent('p2')],
      nextCursor: null,
    });
    const a = removeComment(s0, 'p1');
    expect(ids(a.state)).toEqual(['p2']);
    expect(a.removed).toBe(5);
    const b = removeComment(s0, 'r1');
    expect(b.state.items[0]!.replies).toEqual([]);
    expect(b.state.items[0]!.replyCount).toBe(3);
    expect(b.removed).toBe(1);
    expect(removeComment(s0, 'zzz')).toMatchObject({ removed: 0 });
  });
});
