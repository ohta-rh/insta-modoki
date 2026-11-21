import { describe, expect, it } from 'vitest';
import { generateDataset, BASE_TIME_MS, SEED } from './generate';
import { BENCH, DEMO } from './profiles';

describe('generateDataset', () => {
  it('同じ seed なら同じ並びを作る', () => {
    const a = generateDataset(DEMO, SEED);
    const b = generateDataset(DEMO, SEED);
    expect(a.users.map((u) => u.username)).toEqual(b.users.map((u) => u.username));
    expect(a.posts.map((p) => p.caption)).toEqual(b.posts.map((p) => p.caption));
    expect(a.posts.map((p) => p.createdAt)).toEqual(b.posts.map((p) => p.createdAt));
    expect(a.likes).toEqual(b.likes);
    expect(a).toEqual(b);
  });

  it('seed が違えば並びが違う', () => {
    const a = generateDataset(DEMO, SEED);
    const b = generateDataset(DEMO, SEED + 1);
    expect(a.posts.map((p) => p.caption)).not.toEqual(b.posts.map((p) => p.caption));
    expect(a.likes).not.toEqual(b.likes);
  });

  it('createdAt は固定の基準日から 1 件ごとに進む', () => {
    const { posts } = generateDataset(DEMO, SEED);
    expect(BASE_TIME_MS).toBe(Date.UTC(2026, 10, 1));
    expect(posts[0]!.createdAt).toBeGreaterThan(BASE_TIME_MS - 1);
    for (let i = 1; i < posts.length; i += 1) {
      expect(posts[i]!.createdAt).toBeGreaterThan(posts[i - 1]!.createdAt);
    }
  });

  it('利用者は demo と seed_user_01 からで メールは seed.invalid になる', () => {
    const { users } = generateDataset(DEMO, SEED);
    expect(users).toHaveLength(30);
    expect(users[0]!.username).toBe('demo');
    expect(users[1]!.username).toBe('seed_user_01');
    expect(users[29]!.username).toBe('seed_user_29');
    for (const u of users) {
      expect(u.email).toBe(`${u.username}@seed.invalid`);
      expect(u.displayName.length).toBeGreaterThanOrEqual(1);
      expect(u.displayName.length).toBeLessThanOrEqual(30);
    }
    expect(new Set(users.map((u) => u.username)).size).toBe(30);
  });

  it('demo は 300 件で 1 枚が 240 件 2〜5 枚が 57 件 10 枚が 3 件になる', () => {
    const { posts, media } = generateDataset(DEMO, SEED);
    expect(posts).toHaveLength(300);
    const counts = posts.map((p) => p.mediaCount);
    expect(counts.filter((c) => c === 1)).toHaveLength(240);
    expect(counts.filter((c) => c >= 2 && c <= 5)).toHaveLength(57);
    expect(counts.filter((c) => c === 10)).toHaveLength(3);
    expect(media).toHaveLength(counts.reduce((a, b) => a + b, 0));
    expect(new Set(media.map((m) => m.imageIndex)).size).toBe(media.length);
  });

  it('いいねは 1 投稿 0〜12 人で組が重ならず コメントの返信は 1 階層だけ', () => {
    const { posts, likes, comments } = generateDataset(DEMO, SEED);
    expect(new Set(likes.map((l) => `${l.userIndex}:${l.postIndex}`)).size).toBe(likes.length);
    const perPost = new Array<number>(posts.length).fill(0);
    for (const l of likes) perPost[l.postIndex]! += 1;
    expect(Math.max(...perPost)).toBeLessThanOrEqual(12);
    const cPer = new Array<number>(posts.length).fill(0);
    for (const c of comments) cPer[c.postIndex]! += 1;
    expect(Math.max(...cPer)).toBeLessThanOrEqual(6);
    const replies = comments.filter((c) => c.parentIndex !== null);
    expect(replies.length).toBeGreaterThan(0);
    for (const r of replies) {
      const parent = comments[r.parentIndex!]!;
      expect(r.parentIndex!).toBeLessThan(comments.indexOf(r));
      expect(parent.parentIndex).toBeNull();
      expect(parent.postIndex).toBe(r.postIndex);
      expect(r.createdAt).toBeGreaterThan(parent.createdAt);
    }
  });

  it('demo が 20 人をフォローし その投稿が 100 件以上ある', () => {
    const { follows, posts } = generateDataset(DEMO, SEED);
    const mine = follows.filter((f) => f.followerIndex === 0);
    expect(mine).toHaveLength(20);
    const followees = new Set(mine.map((f) => f.followeeIndex));
    expect(followees.has(0)).toBe(false);
    expect(posts.filter((p) => followees.has(p.authorIndex)).length).toBeGreaterThanOrEqual(100);
    expect(new Set(follows.map((f) => `${f.followerIndex}:${f.followeeIndex}`)).size).toBe(
      follows.length,
    );
    for (const f of follows) expect(f.followerIndex).not.toBe(f.followeeIndex);
  });

  it('bench は 1,000 人 10,000 件で 画像は 60 枚のプールを使い回す', () => {
    const d = generateDataset(BENCH, SEED);
    expect(d.users).toHaveLength(1000);
    expect(d.posts).toHaveLength(10000);
    expect(d.imageCount).toBe(60);
    for (const m of d.media) expect(m.imageIndex).toBeLessThan(60);
    expect(d.follows.filter((f) => f.followerIndex === 0)).toHaveLength(100);
  });
});
