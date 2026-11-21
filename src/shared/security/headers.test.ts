import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, buildSecurityHeaders } from './headers.ts';

const base = { mediaOrigin: null, production: false } as const;

function directive(csp: string, name: string): string[] {
  const found = csp.split('; ').find((part) => part === name || part.startsWith(`${name} `));
  return found === undefined ? [] : found.split(' ').slice(1);
}

describe('buildSecurityHeaders', () => {
  it('script-src に unsafe-inline と unsafe-eval を含まない', () => {
    const script = directive(buildSecurityHeaders(base)['Content-Security-Policy']!, 'script-src');
    expect(script.length).toBeGreaterThan(0);
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('script-src に外部の origin を含まない', () => {
    const script = directive(
      buildSecurityHeaders({ ...base, mediaOrigin: 'http://localhost:3900', nonce: 'abc' })[
        'Content-Security-Policy'
      ]!,
      'script-src',
    );
    expect(script).toEqual(["'self'", "'nonce-abc'"]);
  });

  it('CSP が固定の指令を全て持つ', () => {
    const csp = buildSecurityHeaders(base)['Content-Security-Policy']!;
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'font-src')).toEqual(["'self'"]);
    expect(directive(csp, 'style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it('nosniff が付く', () => {
    expect(buildSecurityHeaders(base)['X-Content-Type-Options']).toBe('nosniff');
  });

  it('Referrer-Policy が付く', () => {
    expect(buildSecurityHeaders(base)['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('Permissions-Policy が付く', () => {
    expect(buildSecurityHeaders(base)['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
  });

  it('MEDIA_ORIGIN が img-src と connect-src と media-src に入る', () => {
    const csp = buildSecurityHeaders({ ...base, mediaOrigin: 'http://localhost:3900' })[
      'Content-Security-Policy'
    ]!;
    expect(directive(csp, 'img-src')).toEqual([
      "'self'",
      'data:',
      'blob:',
      'http://localhost:3900',
    ]);
    expect(directive(csp, 'connect-src')).toEqual(["'self'", 'http://localhost:3900']);
    expect(directive(csp, 'media-src')).toEqual(["'self'", 'http://localhost:3900']);
  });

  it('MEDIA_ORIGIN が script-src に入らない', () => {
    const csp = buildSecurityHeaders({ ...base, mediaOrigin: 'http://localhost:3900' })[
      'Content-Security-Policy'
    ]!;
    expect(directive(csp, 'script-src')).not.toContain('http://localhost:3900');
    expect(directive(csp, 'style-src')).not.toContain('http://localhost:3900');
  });

  it('MEDIA_ORIGIN が未設定のとき self だけ', () => {
    const csp = buildSecurityHeaders(base)['Content-Security-Policy']!;
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive(csp, 'connect-src')).toEqual(["'self'"]);
    expect(directive(csp, 'media-src')).toEqual(["'self'"]);
  });

  it('production のときだけ upgrade-insecure-requests が付く', () => {
    const prod = buildSecurityHeaders({ ...base, production: true })['Content-Security-Policy']!;
    const local = buildSecurityHeaders(base)['Content-Security-Policy']!;
    expect(prod.endsWith('; upgrade-insecure-requests')).toBe(true);
    expect(local).not.toContain('upgrade-insecure-requests');
  });

  it('ヘッダーの値に改行と制御文字が無い', () => {
    const headers = buildSecurityHeaders({
      mediaOrigin: 'https://a.example',
      production: true,
      nonce: 'abc123',
    });
    expect(Object.keys(headers)).toHaveLength(4);
    for (const value of Object.values(headers)) {
      // eslint-disable-next-line no-control-regex
      expect(value).not.toMatch(/[\u0000-\u001f\u007f]/);
    }
  });

  it('nonce が制御文字や空白や引用符を含むとき投げる', () => {
    for (const nonce of ["a'b", 'a b', 'a;b', 'a\nb', '']) {
      expect(() => buildSecurityHeaders({ ...base, nonce })).toThrow('nonce が不正です');
    }
  });
});

describe('applySecurityHeaders', () => {
  it('既にある CSP を置き換え、CSP は 1 つだけになる', () => {
    const headers = new Headers({ 'Content-Security-Policy': 'default-src *' });
    applySecurityHeaders(headers, base);
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(headers.get('Content-Security-Policy')).not.toContain('*');
  });

  it('4 つのヘッダーを付ける', () => {
    const headers = new Headers();
    applySecurityHeaders(headers, base);
    for (const name of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(headers.has(name)).toBe(true);
    }
  });
});
