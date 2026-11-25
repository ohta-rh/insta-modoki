import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The fixtures need a running app, so this reads their source: the helpers that set a user up for
// a spec must go through the E2E harness (ADR-0069), never through the sign-up screen.
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const auth = read('./auth.ts');
const screens = read('./screens.ts');
const fixturesOf = (source: string) => source.slice(source.indexOf('/** `test` whose'));

describe('E2E の用意の関数', () => {
  it('fixtures sign in through the harness, not the sign-up screen', () => {
    const fixtures = fixturesOf(auth);
    expect(fixtures).toContain('signInViaHarness(');
    expect(fixtures).not.toContain('signUpViaUi(');
    expect(screens).toContain('signInViaHarness(');
    expect(screens).not.toContain('signUpViaUi');
  });

  it('signUpViaUi stays for the specs of the sign-up screens', () => {
    expect(auth).toContain('export async function signUpViaUi(');
  });
});
