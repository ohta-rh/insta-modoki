import { describe, expect, it } from 'vitest';
import { BRAND } from '../ui/brand';
import { TOKENS } from '../ui/tokens';
import { buildManifest } from './manifest';

describe('buildManifest', () => {
  it('buildManifest は必須の項目と 3 つのアイコンを返す', () => {
    const m = buildManifest();
    expect(m).toMatchObject({
      id: '/',
      name: BRAND.name,
      short_name: BRAND.name,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'ja',
      theme_color: TOKENS['--color-bg'],
      background_color: TOKENS['--color-bg'],
    });
    expect(m.icons).toHaveLength(3);
    expect(m.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });
});
