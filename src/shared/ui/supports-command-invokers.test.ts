import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportsCommandInvokers } from './supports-command-invokers';

describe('supportsCommandInvokers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('HTMLButtonElement.prototype に command があれば true', () => {
    vi.stubGlobal('HTMLButtonElement', { prototype: { command: '' } });
    expect(supportsCommandInvokers()).toBe(true);
  });

  it('command が無ければ false', () => {
    vi.stubGlobal('HTMLButtonElement', { prototype: {} });
    expect(supportsCommandInvokers()).toBe(false);
  });

  it('HTMLButtonElement が無い環境（サーバー）では false', () => {
    expect(supportsCommandInvokers()).toBe(false);
  });
});
