import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import type { StorageEnv } from '../../../shared/storage';
import { loadPostTiles } from './load-post-tiles';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

describe('loadPostTiles', () => {
  it('入力の id の順に表紙・写真の枚数・投稿者名を返し、存在しない id は飛ばす', async () => {
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const p1 = await createPost(t.db, a.id, { mediaCount: 3, altText: '猫' });
    const p2 = await createPost(t.db, b.id);
    const tiles = await loadPostTiles(t.db, storage, [p2.id, crypto.randomUUID(), p1.id]);
    expect(tiles.map((x) => x.id)).toEqual([p2.id, p1.id]);
    expect(tiles.map((x) => x.username)).toEqual([b.username, a.username]);
    expect(tiles.map((x) => x.mediaCount)).toEqual([1, 3]);
    expect(tiles[1]!.cover.altText).toBe('猫');
    expect(tiles[1]!.cover.srcset.w320).toContain(`${p1.media[0]!.storageKey}/w320.webp`);
  });

  it('id が空なら空の配列を返す', async () => {
    expect(await loadPostTiles(t.db, storage, [])).toEqual([]);
  });
});
