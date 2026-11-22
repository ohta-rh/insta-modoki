import { describe, expect, it } from 'vitest';
import { nextFromQueue, saveStoryQueue } from './story-queue';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};
const broken = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('story queue', () => {
  it('記憶域の失敗を無視する', () => {
    expect(() => saveStoryQueue(['a'], broken)).not.toThrow();
    expect(nextFromQueue('a', broken)).toEqual({ inQueue: false });
  });

  it('壊れた値や並びが無いときは順番の外として扱う', () => {
    const storage = memory();
    storage.setItem('storyQueue', '{"a":1}');
    expect(nextFromQueue('a', storage)).toEqual({ inQueue: false });
    storage.setItem('storyQueue', '["a",1,"b"]');
    expect(nextFromQueue('a', storage)).toEqual({ inQueue: false });
  });

  it('順番の中にいる人は順番だけで次を決め 最後なら閉じる', () => {
    const storage = memory();
    saveStoryQueue(['b', 'c'], storage);
    expect(nextFromQueue('b', storage)).toEqual({ inQueue: true, next: 'c' });
    expect(nextFromQueue('c', storage)).toEqual({ inQueue: true, next: null });
  });

  it('順番が無いか 中にいない人はサーバーの次の人を使う', () => {
    const storage = memory();
    expect(nextFromQueue('b', storage)).toEqual({ inQueue: false });
    saveStoryQueue(['b', 'c'], storage);
    expect(nextFromQueue('z', storage)).toEqual({ inQueue: false });
    storage.setItem('storyQueue', '{not json');
    expect(nextFromQueue('b', storage)).toEqual({ inQueue: false });
    expect(nextFromQueue('b', broken)).toEqual({ inQueue: false });
    expect(nextFromQueue('b', null)).toEqual({ inQueue: false });
  });
});
