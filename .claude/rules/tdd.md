---
paths:
  - "src/**"
  - "app/**"
  - "tests/**"
  - "e2e/**"
  - "scripts/**"
  - "**/*.test.*"
  - "**/*.spec.*"
---

# Test-driven development (ADR-0009)

Every change to executable code is test-driven. No exceptions for "small" or "obvious" changes.

1. **Start from the acceptance criterion.** Write the test that proves the AC (E2E for a
   screen-observable AC, otherwise unit or integration) before any production code.
2. **Red.** Run it and watch it fail **for the expected reason** (an assertion about the missing
   behavior, not a typo, import error or setup failure). Record the failing output line in the
   TDD record.
3. **Green.** Write the least code that passes. Run the touched tests.
4. **Refactor** with the tests green. Then the next behavior.
5. A bug is fixed the same way: a test that reproduces it fails first, then the fix.

- Tests land in the same commit as the code they cover.
- Never mock the database in integration tests; use the slot's test database
  (`.claude/rules/local-environment.md`).
- Never `.skip` / `.only` / weaken an assertion / exclude a file from coverage to get green.
- E2E waits on observable state (role, text, URL), never on fixed sleeps.

The TDD record (in the implementer's report and the issue's closing comment) lists, per
behavior: the test name, the red output line, and the commit that turned it green.
