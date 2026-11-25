import { afterEach, describe, expect, it, vi } from 'vitest';
import UploadHarnessPage from './page';

const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;

describe('/e2e-harness/upload', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('E2E_HARNESS が無いとき 404 にする', () => {
    vi.stubEnv('E2E_HARNESS', '');
    vi.stubEnv('APP_ENV', 'local');
    expect(() => UploadHarnessPage()).toThrow(NOT_FOUND);
  });

  it('E2E_HARNESS が 1 で APP_ENV が local のとき 画面を返す', () => {
    vi.stubEnv('E2E_HARNESS', '1');
    vi.stubEnv('APP_ENV', 'local');
    expect(UploadHarnessPage()).toBeTruthy();
  });

  it('E2E_HARNESS が 1 でも APP_ENV が production のとき 404 にする', () => {
    vi.stubEnv('E2E_HARNESS', '1');
    vi.stubEnv('APP_ENV', 'production');
    expect(() => UploadHarnessPage()).toThrow(NOT_FOUND);
  });
});
