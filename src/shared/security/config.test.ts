import { describe, expect, it } from 'vitest';
import { readSecurityConfig } from './config.ts';

const message = 'MEDIA_ORIGIN は origin（例 https://example.com）で指定してください';

describe('readSecurityConfig', () => {
  it('未設定のとき mediaOrigin は null、production は false', () => {
    expect(readSecurityConfig({})).toEqual({
      mediaOrigin: null,
      uploadOrigin: null,
      production: false,
    });
  });

  it('空文字は未設定として扱う', () => {
    expect(readSecurityConfig({ MEDIA_ORIGIN: '' }).mediaOrigin).toBeNull();
  });

  it('origin ではない文字列は投げる', () => {
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'not a url' })).toThrow(message);
  });

  it('パスのある値は投げる', () => {
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example/path' })).toThrow(message);
  });

  it('末尾に / のある値は投げる', () => {
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example/' })).toThrow(message);
  });

  it('http と https 以外のスキームは投げる', () => {
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'javascript:alert(1)' })).toThrow(message);
  });

  it('指令の区切りを含む値は投げる', () => {
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example; script-src *' })).toThrow(
      message,
    );
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example;' })).toThrow(message);
  });

  it('改行を含む値は投げる', () => {
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example\nX-Evil: 1' })).toThrow(
      message,
    );
    expect(() => readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example\r' })).toThrow(message);
  });

  it('https の origin は通る', () => {
    expect(readSecurityConfig({ MEDIA_ORIGIN: 'https://a.example' }).mediaOrigin).toBe(
      'https://a.example',
    );
  });

  it('localhost の http の origin は通る', () => {
    expect(readSecurityConfig({ MEDIA_ORIGIN: 'http://localhost:3900' }).mediaOrigin).toBe(
      'http://localhost:3900',
    );
  });

  it('APP_ENV が production のときだけ production が true', () => {
    expect(readSecurityConfig({ APP_ENV: 'production' }).production).toBe(true);
    expect(readSecurityConfig({ APP_ENV: 'local' }).production).toBe(false);
    expect(readSecurityConfig({ APP_ENV: 'test' }).production).toBe(false);
  });

  it('APP_ENV が不正なとき投げる', () => {
    expect(() => readSecurityConfig({ APP_ENV: 'staging' })).toThrow('APP_ENV');
  });

  it('S3_ENDPOINT の origin が uploadOrigin になる（署名付き PUT の送り先）', () => {
    expect(readSecurityConfig({ S3_ENDPOINT: 'http://localhost:3910' }).uploadOrigin).toBe(
      'http://localhost:3910',
    );
    expect(
      readSecurityConfig({ S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com/' }).uploadOrigin,
    ).toBe('https://acct.r2.cloudflarestorage.com');
  });

  it('S3_ENDPOINT が未設定・空・http(s) でないとき uploadOrigin は null', () => {
    expect(readSecurityConfig({}).uploadOrigin).toBeNull();
    expect(readSecurityConfig({ S3_ENDPOINT: '' }).uploadOrigin).toBeNull();
    expect(readSecurityConfig({ S3_ENDPOINT: 'javascript:alert(1)' }).uploadOrigin).toBeNull();
    expect(readSecurityConfig({ S3_ENDPOINT: 'http://a;b' }).uploadOrigin).toBeNull();
  });
});
