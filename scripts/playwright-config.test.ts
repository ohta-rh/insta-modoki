import { afterEach, describe, expect, it, vi } from 'vitest';

// playwright.config.ts reads CI when it is imported, so each case sets the variable and
// imports a fresh copy (ADR-0027, ADR-0070).
async function loadConfig(ci: string | undefined) {
  vi.resetModules();
  if (ci === undefined) vi.stubEnv('CI', '');
  else vi.stubEnv('CI', ci);
  return (await import('../playwright.config')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('playwright.config.ts', () => {
  it('the local run keeps a trace for failed tests', async () => {
    const config = await loadConfig(undefined);
    expect(config.use?.trace).toBe('retain-on-failure');
    expect(config.reporter).toBe('list');
  });

  it('CI keeps its trace and HTML report', async () => {
    const config = await loadConfig('true');
    expect(config.use?.trace).toBe('retain-on-failure');
    expect(config.reporter).toEqual([['list'], ['html', { open: 'never' }]]);
  });
});
