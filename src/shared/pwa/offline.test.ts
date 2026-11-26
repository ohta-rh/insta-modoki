import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../ui/contrast';
import { FOOTER_NOTICE } from '../ui/brand';

const html = readFileSync(
  fileURLToPath(new URL('../../../public/assets/offline.html', import.meta.url)),
  'utf8',
);

describe('public/assets/offline.html', () => {
  it('案内の画面に、非公式である旨の文言が含まれる', () => {
    expect(html).toContain(FOOTER_NOTICE);
  });

  it('日本語で、見出しが 1 つ、JS を使わない再読み込みのフォームがある', () => {
    expect(html).toContain('<html lang="ja">');
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('<h1>オフラインです</h1>');
    expect(html).toContain('インターネットに接続してからもう一度お試しください');
    expect(html).toContain('<form action="/" method="get">');
    expect(html).not.toMatch(/<script/i);
  });

  it('ボタンの色の組は 4.5 : 1 以上', () => {
    expect(contrastRatio('#ffffff', '#4f46c8')).toBeGreaterThanOrEqual(4.5);
    expect(html).toContain('#4f46c8');
  });
});
