import { BRAND } from '../ui/brand';
import { TOKENS } from '../ui/tokens';

export type ManifestIcon = {
  src: string;
  sizes: string;
  type: 'image/png';
  purpose: 'any' | 'maskable';
};

export type AppManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: 'standalone';
  lang: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

export function buildManifest(): AppManifest {
  return {
    id: '/',
    name: BRAND.name,
    short_name: BRAND.name,
    description: '写真を共有する学習用のアプリ（非公式）',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ja',
    theme_color: TOKENS['--color-bg'],
    background_color: TOKENS['--color-bg'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
