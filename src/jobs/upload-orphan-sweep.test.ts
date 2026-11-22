import { describe, expect, it } from 'vitest';
import { jobs } from './index';
import {
  baseKeyOf,
  isPastGrace,
  sweepUnreferencedUploads,
  UPLOAD_GRACE_MS,
} from './upload-orphan-sweep';

describe('isPastGrace', () => {
  it('ちょうど 24 時間は残し 1 ms 過ぎると消す対象にする', () => {
    const now = 1_800_000_000_000;
    expect(UPLOAD_GRACE_MS).toBe(24 * 60 * 60 * 1000);
    expect(isPastGrace(now - UPLOAD_GRACE_MS, now)).toBe(false);
    expect(isPastGrace(now - UPLOAD_GRACE_MS - 1, now)).toBe(true);
    expect(isPastGrace(now - UPLOAD_GRACE_MS + 1, now)).toBe(false);
    expect(isPastGrace(now + 1000, now)).toBe(false);
  });
});

describe('baseKeyOf', () => {
  it('<media|stories>/<id>/<id>/<ファイル名> の形だけ最後の / より前を返す', () => {
    expect(baseKeyOf('media/u1/p1/orig.webp')).toBe('media/u1/p1');
    expect(baseKeyOf('stories/u1/s1/video.mp4')).toBe('stories/u1/s1');
  });

  it('形の違うキーは null にする', () => {
    for (const key of [
      'media/u1/loose.webp',
      'media/u1/p1/sub/x.webp',
      'other/u1/p1/orig.webp',
      'media//p1/orig.webp',
      'media/u1//orig.webp',
      'media/u1/p1/',
      'xmedia/u1/p1/orig.webp',
      'media/u1/p1/orig.webp\n',
      '',
    ]) {
      expect(baseKeyOf(key), key).toBeNull();
    }
  });
});

describe('jobs', () => {
  it('登録表に upload-orphan-sweep として載る', () => {
    expect(jobs['upload-orphan-sweep']).toBe(sweepUnreferencedUploads);
  });
});
