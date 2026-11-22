import { describe, expect, it } from 'vitest';
import { buildTray, type TrayStory } from './tray';

const NOW = 1_700_000_000_000;
const story = (id: string, authorId: string, createdAt: number, over: Partial<TrayStory> = {}) => ({
  id,
  authorId,
  createdAt: new Date(createdAt),
  expiresAt: new Date(createdAt + 86_400_000),
  username: `name_${authorId}`,
  displayName: `Name ${authorId}`,
  avatarKey: null,
  ...over,
});

describe('buildTray', () => {
  it('未読のある人を先に 最新のストーリーが新しい順に並べる', () => {
    const stories = [
      story('s1', 'a', NOW - 5000),
      story('s2', 'b', NOW - 4000),
      story('s3', 'c', NOW - 3000),
      story('s4', 'c', NOW - 6000),
      story('s5', 'd', NOW - 1000),
    ];
    const tray = buildTray(stories, new Set(['s1', 's2', 's5']), NOW);
    // a, b, d fully seen; c has the unseen s3. Seen ones by newest first: d, b, a.
    expect(tray.map((t) => t.authorId)).toEqual(['c', 'd', 'b', 'a']);
    expect(tray.map((t) => t.hasUnseen)).toEqual([true, false, false, false]);
    expect(tray[0]).toMatchObject({
      latestAt: NOW - 3000,
      storyIds: ['s4', 's3'],
      user: { username: 'name_c', displayName: 'Name c', avatarKey: null },
    });
  });

  it('同時刻は authorId の降順で 一部だけ既読の人は未読に数える', () => {
    const stories = [
      story('s1', 'a', NOW - 1000),
      story('s2', 'b', NOW - 1000),
      story('s3', 'c', NOW - 9000),
      story('s4', 'c', NOW - 8000),
    ];
    const tray = buildTray(stories, new Set(['s1', 's2', 's3']), NOW);
    expect(tray.map((t) => t.authorId)).toEqual(['c', 'b', 'a']);
    expect(tray[0]!.hasUnseen).toBe(true);
  });

  it('期限が過ぎたものは入れず 50 人までにする', () => {
    expect(buildTray([story('s1', 'a', NOW - 90_000_000)], new Set(), NOW)).toEqual([]);
    const many = Array.from({ length: 60 }, (_, i) => story(`s${i}`, `u${i}`, NOW - i * 1000));
    expect(buildTray(many, new Set(), NOW)).toHaveLength(50);
  });
});
