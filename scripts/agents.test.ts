import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const AGENTS = ['pbi-implementer', 'code-reviewer', 'security-reviewer', 'epic-tester'] as const;
const agent = (name: string) => read(`.claude/agents/${name}.md`);

/** The text of one `## <heading>` section, up to the next `## `. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start === -1) return '';
  const rest = text.slice(start + 1);
  const next = rest.indexOf('\n## ', 4);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('delivery agent definitions', () => {
  it('every delivery agent defines the evidence rule', () => {
    for (const name of AGENTS) {
      const evidence = section(agent(name), 'Evidence');
      expect(evidence, `${name}.md has no "## Evidence" section`).not.toBe('');
      expect(evidence).toContain('cmd > "$LOG" 2>&1; echo "rc=$?"');
      expect(evidence).toContain('rc=<n>');
      expect(evidence).toContain('result line');
      expect(evidence).toContain('未実行');
    }
  });

  it('every delivery agent checks that pnpm starts first', () => {
    for (const name of AGENTS) {
      const first = section(agent(name), 'First');
      expect(first, `${name}.md has no "## First" section`).not.toBe('');
      expect(first).toContain('pnpm --version');
      expect(first).toContain('copy its output');
      expect(first).toContain('another way');
      const reviewer = name === 'code-reviewer' || name === 'security-reviewer';
      if (reviewer) {
        expect(first).toContain('未実行（pnpm が起動しない');
        expect(first).toContain('CHECKED');
      } else {
        expect(first).toContain('BLOCKED');
      }
    }
  });
});

describe('delivery rule', () => {
  const delivery = read('.claude/rules/delivery.md');

  it('the delivery rule makes the Director check the evidence lines', () => {
    const loop = section(delivery, '3. The loop per PBI — until every AC and DoD item holds');
    expect(loop).toContain('`rc=` line and the result line');
    expect(loop).toContain('re-runs it or opens the log');
  });

  it('the delivery rule runs the ci-gate before dispatch and after a push', () => {
    const dispatch = section(delivery, '2. Dispatch (parallel by default)');
    const integration = section(delivery, '4. Integration (Director, one PBI at a time)');
    expect(dispatch).toContain('node scripts/ci-gate.mjs <integration branch>');
    expect(integration).toContain('node scripts/ci-gate.mjs <integration branch>');
  });
});
