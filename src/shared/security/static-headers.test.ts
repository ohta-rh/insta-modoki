import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from './headers.ts';

describe('public/_headers', () => {
  it('静的ファイルに付けるヘッダーは buildSecurityHeaders の既定と同じ', () => {
    const text = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8');
    const [pattern, ...lines] = text.trim().split('\n');
    expect(pattern).toBe('/*');
    const written = Object.fromEntries(
      lines.map((line) => {
        const at = line.indexOf(':');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
    );
    expect(written).toEqual(buildSecurityHeaders({ mediaOrigin: null, production: false }));
  });
});
