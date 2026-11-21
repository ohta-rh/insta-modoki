import { afterEach, describe, expect, it, vi } from 'vitest';
import UploadHarnessPage from './page';

describe('/e2e-harness/upload', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('APP_ENV が production のとき 404 にする', () => {
    vi.stubEnv('APP_ENV', 'production');
    expect(() => UploadHarnessPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it('APP_ENV が local のとき 画面を返す', () => {
    vi.stubEnv('APP_ENV', 'local');
    expect(UploadHarnessPage()).toBeTruthy();
  });
});
