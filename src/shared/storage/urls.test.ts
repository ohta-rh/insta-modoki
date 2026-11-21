import { describe, expect, it } from 'vitest';
import { avatarUrl, mediaSrcset, publicUrl } from './urls';

const base = { S3_ENDPOINT: 'http://localhost:3910', S3_BUCKET: 'insta-s3' };

describe('publicUrl / mediaSrcset', () => {
  it('公開の基底の URL が無いとき エンドポイントとバケットから組み立てる', () => {
    expect(publicUrl(base, 'media/u/k/orig.webp')).toBe(
      'http://localhost:3910/insta-s3/media/u/k/orig.webp',
    );
  });

  it('公開の基底の URL があるとき 末尾の / を除いてそれを使う', () => {
    expect(
      publicUrl(
        { ...base, S3_PUBLIC_BASE_URL: 'https://media.example.com/' },
        'media/u/k/w320.webp',
      ),
    ).toBe('https://media.example.com/media/u/k/w320.webp');
  });

  it('storage_key から 3 つの幅の URL を返す', () => {
    expect(mediaSrcset(base, 'media/u/k')).toEqual({
      w320: 'http://localhost:3910/insta-s3/media/u/k/w320.webp',
      w640: 'http://localhost:3910/insta-s3/media/u/k/w640.webp',
      w1080: 'http://localhost:3910/insta-s3/media/u/k/w1080.webp',
    });
  });

  it('ローカルのウェブ配信（バケットがホスト名）の基底でも バケットの段を足さない', () => {
    const env = { ...base, S3_PUBLIC_BASE_URL: 'http://insta-s3.web.localhost:3912' };
    expect(mediaSrcset(env, 'media/u/k').w640).toBe(
      'http://insta-s3.web.localhost:3912/media/u/k/w640.webp',
    );
  });
});

describe('avatarUrl', () => {
  it('キーがあるとき 320 幅の公開 URL を返す', () => {
    expect(avatarUrl(base, 'avatars/u/k')).toBe(
      'http://localhost:3910/insta-s3/avatars/u/k/w320.webp',
    );
  });

  it('キーが null のとき null を返す', () => {
    expect(avatarUrl(base, null)).toBeNull();
  });
});
