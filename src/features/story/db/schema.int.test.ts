import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { stories, storyViews } from './schema';

const t = useTestDb();
const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

type Row = Record<string, string | number | null>;
async function insert(table: string, row: Row) {
  const cols = Object.keys(row);
  const stmt = t.d1.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  );
  return (stmt as unknown as { bind(...v: unknown[]): { run(): Promise<unknown> } })
    .bind(...cols.map((c) => row[c]))
    .run();
}
const user = (id: string) =>
  insert('users', {
    id,
    username: `user_${id}`,
    display_name: `User ${id}`,
    email: `${id}@example.com`,
    created_at: NOW,
    updated_at: NOW,
  });
const story = (id: string, over: Row = {}) =>
  insert('stories', {
    id,
    author_id: 'a',
    type: 'image',
    storage_key: `stories/a/${id}`,
    width: 100,
    height: 200,
    duration_ms: null,
    created_at: NOW,
    expires_at: NOW + DAY,
    ...over,
  });
const count = async (table: string) =>
  (await t.d1.prepare(`SELECT count(*) AS n FROM ${table}`).all<{ n: number }>()).results[0]!.n;

describe('stories と story_views', () => {
  it('Drizzle の列と索引はマイグレーションと一致する', async () => {
    for (const table of [stories, storyViews]) {
      const cfg = getTableConfig(table);
      const info = (await t.d1.prepare(`PRAGMA table_info(${cfg.name})`).all<{ name: string }>())
        .results;
      expect(info.map((c) => c.name).sort(), cfg.name).toEqual(
        cfg.columns.map((c) => c.name).sort(),
      );
    }
    const indexes = (
      await t.d1
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'stor%'")
        .all<{ name: string }>()
    ).results.map((r) => r.name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'stories_author_id_expires_at_idx',
        'stories_expires_at_idx',
        'story_views_story_id_created_at_idx',
        'story_views_viewer_id_idx',
      ]),
    );
  });

  it('写真と動画の行は通り 種類と長さの組が合わないものは拒まれる', async () => {
    await user('a');
    await story('i1');
    await story('v1', { type: 'video', duration_ms: 15_000 });
    await expect(story('x1', { type: 'gif' })).rejects.toThrow(/stories_type_check/);
    await expect(story('x2', { duration_ms: 1000 })).rejects.toThrow(/stories_duration_ms_check/);
    await expect(story('x3', { type: 'video', duration_ms: null })).rejects.toThrow(
      /stories_duration_ms_check/,
    );
    await expect(story('x4', { type: 'video', duration_ms: 15_001 })).rejects.toThrow(
      /stories_duration_ms_check/,
    );
    await expect(story('x5', { type: 'video', duration_ms: 0 })).rejects.toThrow(
      /stories_duration_ms_check/,
    );
    expect(await count('stories')).toBe(2);
  });

  it('大きさ 代替テキスト 期限の制約と storage_key の一意を守る', async () => {
    await user('a');
    await expect(story('x1', { width: 0 })).rejects.toThrow(/stories_width_check/);
    await expect(story('x2', { height: 10_001 })).rejects.toThrow(/stories_height_check/);
    await expect(story('x3', { alt_text: 'あ'.repeat(501) })).rejects.toThrow(
      /stories_alt_text_check/,
    );
    await story('x4', { alt_text: 'あ'.repeat(500) });
    await expect(story('x5', { expires_at: NOW + DAY + 1 })).rejects.toThrow(
      /stories_expires_at_check/,
    );
    await story('s1', { storage_key: 'stories/a/same' });
    await expect(story('s2', { storage_key: 'stories/a/same' })).rejects.toThrow(
      /UNIQUE constraint failed: stories.storage_key/,
    );
  });

  it('story_views は同じ組を 2 回入れられず 利用者かストーリーを消すと消える', async () => {
    await user('a');
    await user('b');
    await story('s1');
    await insert('story_views', { story_id: 's1', viewer_id: 'b', created_at: NOW });
    await expect(
      insert('story_views', { story_id: 's1', viewer_id: 'b', created_at: NOW }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('ストーリーか閲覧者か投稿者を消すと story_views と stories が一緒に消える', async () => {
    await user('a');
    await user('b');
    await story('s1');
    await story('s2');
    await insert('story_views', { story_id: 's1', viewer_id: 'b', created_at: NOW });
    await insert('story_views', { story_id: 's2', viewer_id: 'b', created_at: NOW });
    await t.d1.prepare("DELETE FROM stories WHERE id = 's1'").run();
    expect(await count('story_views')).toBe(1);
    await t.d1.prepare("DELETE FROM users WHERE id = 'b'").run();
    expect(await count('story_views')).toBe(0);
    await t.d1.prepare("DELETE FROM users WHERE id = 'a'").run();
    expect(await count('stories')).toBe(0);
  });
});
