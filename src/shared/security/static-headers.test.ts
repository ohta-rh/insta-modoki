import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './headers.ts';

/** Splits `_headers` into `{ pattern: { name: value } }` (a pattern starts at column 0). */
function sections(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | null = null;
  for (const line of text.trim().split('\n')) {
    if (!line.startsWith(' ')) {
      current = {};
      out[line.trim()] = current;
    } else if (current) {
      const at = line.indexOf(':');
      current[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  }
  return out;
}

const text = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8');

describe('public/_headers', () => {
  it('静的ファイルに付けるヘッダーは buildSecurityHeaders の既定と同じ', () => {
    expect(text.trim().split('\n')[0]).toBe('/*');
    expect(sections(text)['/*']).toEqual(
      buildSecurityHeaders({ mediaOrigin: null, production: false }),
    );
  });

  it('/sw.js は no-cache で、更新をすぐ取りに行かせる', () => {
    expect(sections(text)['/sw.js']).toEqual({ 'Cache-Control': 'no-cache' });
  });
});
