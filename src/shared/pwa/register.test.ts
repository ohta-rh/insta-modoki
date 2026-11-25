import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './register';

describe('registerServiceWorker', () => {
  it('serviceWorker が無い環境でも例外を出さない', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      registerServiceWorker({} as unknown as Navigator, { isSecureContext: true } as Window),
    ).not.toThrow();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('安全でない環境では登録しない', () => {
    const register = vi.fn();
    registerServiceWorker(
      { serviceWorker: { register } } as unknown as Navigator,
      { isSecureContext: false } as Window,
    );
    expect(register).not.toHaveBeenCalled();
  });

  it('安全な環境では /sw.js をスコープ / で登録する', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    registerServiceWorker(
      { serviceWorker: { register } } as unknown as Navigator,
      { isSecureContext: true } as Window,
    );
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('登録が失敗しても例外を出さない', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const register = vi.fn().mockRejectedValue(new Error('boom'));
    expect(() =>
      registerServiceWorker(
        { serviceWorker: { register } } as unknown as Navigator,
        { isSecureContext: true } as Window,
      ),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('register が同期で例外を出しても外へ出さない', () => {
    const register = vi.fn(() => {
      throw new Error('sync');
    });
    expect(() =>
      registerServiceWorker(
        { serviceWorker: { register } } as unknown as Navigator,
        { isSecureContext: true } as Window,
      ),
    ).not.toThrow();
  });
});
