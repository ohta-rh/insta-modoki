import { describe, expect, it } from 'vitest';
import config from '../playwright.config';

const project = (name: string) => config.projects?.find((p) => p.name === name);

describe('playwright.config.ts projects (ADR-0073)', () => {
  it('DB の全体に書くテストは exclusive の project で最後に 1 人で走る', () => {
    const exclusive = project('exclusive');
    expect(exclusive).toBeDefined();
    expect(exclusive?.testMatch).toBe('**/*.exclusive.spec.ts');
    expect(exclusive?.dependencies).toEqual(['chromium', 'seed']);
    for (const name of ['chromium', 'seed']) {
      const ignore = project(name)?.testIgnore;
      const list = Array.isArray(ignore) ? ignore : [ignore];
      expect(list).toContain('**/*.exclusive.spec.ts');
    }
  });
});
