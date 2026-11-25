import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

describe('settings.json hooks', () => {
  it('SessionStart は ci-gate と harness-drift を流す', () => {
    const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8'));
    const entries = (
      settings.hooks?.SessionStart as Array<{ hooks: Array<{ command: string; timeout?: number }> }>
    ).flatMap((h) => h.hooks);
    const entry = entries.find((x) => x.command.includes('scripts/harness-drift.mjs'));
    const command = entry?.command ?? '';
    const gate = command.indexOf('node scripts/ci-gate.mjs "$b" || true');
    const drift = command.indexOf('node scripts/harness-drift.mjs "$b" || true');
    expect(command).toContain('b="$(git config insta.integrationBranch || echo main)"');
    expect(gate).toBeGreaterThan(-1);
    expect(drift).toBeGreaterThan(gate);
    expect(command).toMatch(/\|\| true$/);
    expect(entry?.timeout).toBe(30);
  });
});
