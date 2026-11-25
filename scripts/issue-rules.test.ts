import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';

const rule = readFileSync(
  join(import.meta.dirname, '..', '.claude', 'rules', 'issue-authoring.md'),
  'utf8',
);

test('the issue rule requires a long-text narrow-width AC for visual PBIs', () => {
  assert.match(rule, /^## 見た目の PBI$/m);
  const start = rule.indexOf('## 見た目の PBI');
  const next = rule.indexOf('\n## ', start + 1);
  const section = rule.slice(start, next === -1 ? undefined : next);
  assert.ok(section.includes('375px'));
  assert.ok(section.includes('空白のない長い 1 行'));
});
