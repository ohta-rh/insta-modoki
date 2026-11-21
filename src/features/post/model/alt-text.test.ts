import { describe, expect, it } from 'vitest';
import { photoAlt } from './alt-text';

describe('photoAlt', () => {
  it('uses the author-written text as is', () => {
    expect(photoAlt({ altText: '猫', username: 'alice', position: 2, count: 3 })).toBe('猫');
  });

  it('falls back to the username, the position and the count', () => {
    expect(photoAlt({ altText: '', username: 'alice', position: 2, count: 3 })).toBe(
      'alice が投稿した写真（2 / 3）',
    );
  });

  it('treats blank text as missing', () => {
    expect(photoAlt({ altText: '  ', username: 'alice', position: 1, count: 1 })).toBe(
      'alice が投稿した写真（1 / 1）',
    );
  });
});
