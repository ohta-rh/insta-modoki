import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('eslint config', () => {
  it('lint ignores the .tmp_* scratch folders', async () => {
    const eslint = new ESLint();
    expect(await eslint.isPathIgnored('.tmp_epic87/walk.spec.ts')).toBe(true);
  });

  it('only .tmp_* folders are ignored', async () => {
    const eslint = new ESLint();
    expect(await eslint.isPathIgnored('src/.tmpl.ts')).toBe(false);
  });
});
