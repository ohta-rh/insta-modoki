import { describe, expect, it } from 'vitest';
import { nextInQueue, saveStoryQueue } from './story-queue';

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
  it('保存した並びで次の人を返し、記憶域の失敗を無視する', () => {
    const storage = memory();
    saveStoryQueue(['b', 'c'], storage);
    expect(nextInQueue('b', storage)).toBe('c');
    expect(nextInQueue('c', storage)).toBeNull();
    expect(nextInQueue('z', storage)).toBeNull();
    expect(() => saveStoryQueue(['a'], broken)).not.toThrow();
    expect(nextInQueue('a', broken)).toBeNull();
  });

  it('壊れた値や並びが無いときは null を返す', () => {
    const storage = memory();
    expect(nextInQueue('a', storage)).toBeNull();
    storage.setItem('storyQueue', '{not json');
    expect(nextInQueue('a', storage)).toBeNull();
    storage.setItem('storyQueue', '{"a":1}');
    expect(nextInQueue('a', storage)).toBeNull();
    storage.setItem('storyQueue', '["a",1,"b"]');
    expect(nextInQueue('a', storage)).toBeNull();
  });
});
