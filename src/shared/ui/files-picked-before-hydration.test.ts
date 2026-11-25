import { describe, expect, it } from 'vitest';
import { filesPickedBeforeHydration } from './files-picked-before-hydration';

describe('filesPickedBeforeHydration', () => {
  it('files が 1 枚以上のとき その FileList を返す', () => {
    const files = { length: 1 } as FileList;
    expect(filesPickedBeforeHydration({ files })).toBe(files);
    const many = { length: 11 } as FileList;
    expect(filesPickedBeforeHydration({ files: many })).toBe(many);
  });

  it('input か files が無いか 0 枚のとき null を返す', () => {
    expect(filesPickedBeforeHydration(null)).toBeNull();
    expect(filesPickedBeforeHydration({ files: null })).toBeNull();
    expect(filesPickedBeforeHydration({ files: { length: 0 } as FileList })).toBeNull();
  });
});
