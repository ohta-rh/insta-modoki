# Delivery — Director + sonnet subagents in worktrees (ADR-0007, ADR-0009, ADR-0010)

The main session is the **Director**. It plans dispatch, spawns subagents, verifies their
results, integrates to `main`, and closes issues. It does not write the PBI's code itself.

## 1. Roles

| Role | Agent | Model | Writes | Where |
|---|---|---|---|---|
| Director | main session | settings | merges, issue updates | main checkout |
| Implementer | `pbi-implementer` | sonnet | code, tests, docs of the PBI; commits on its branch | its own worktree |
| Code reviewer | `code-reviewer` | sonnet | nothing (read-only) | reads the implementer's worktree |
| Security reviewer | `security-reviewer` | sonnet | nothing (read-only) | reads the implementer's worktree |
| EPIC tester | `epic-tester` | sonnet | test report + evidence; commits on its branch | its own worktree, real Chrome |

Always pass `model: "sonnet"` explicitly as well; never fork; never pass `name` (one-shot
workers, resumed with SendMessage by agent id). Append the paste block of
`~/.claude/rules/subagent-contract.md` to every implementer prompt.

## 2. Dispatch (parallel by default)

1. **Ground truth.** `git fetch origin`; `main` is not behind `origin/main`; the verify gate on
   `origin/main` is green (red `main` is fixed first, as its own PBI). Before dispatching,
   `node scripts/ci-gate.mjs <integration branch>` exits 0.
2. **Ready set.** Open PBIs of the current milestone whose DoR is fully ticked, whose
   `blocked by` issues are all closed, and whose touch sets do not overlap any in-flight PBI.
   A PBI failing DoR is fixed (issue edited), not taken.
3. **Slots.** Up to 4 PBIs in flight, each with a slot `1..4`
   (`.claude/rules/local-environment.md`). Same-wave PBIs are dispatched in one message.
4. **Worktree per PBI** (created by the Director before spawning — fail-loud if absent):
   `git worktree add .worktrees/pbi-<N> -b pbi/<N> origin/main`, then prepare the slot
   (env file, reset the slot's databases and bucket).
5. **Spawn** `pbi-implementer` with: issue number, absolute worktree path, slot number,
   `ALLOW_COMMIT=true`, the verify command, the contract paste block. Nothing else about the
   design — the issue and the ADRs are the spec.
6. **Isolation check** right after spawn: its first report line states
   `git rev-parse --show-toplevel` and branch; anything other than its worktree and `pbi/<N>`
   → stop it (TaskStop) and abort that dispatch.

## 3. The loop per PBI — until every AC and DoD item holds

```
TDD → impl → code-review ∥ security-review → E2E → verify
 ^                 | changes requested            | fail        | unmet AC/DoD
 └─────────────────┴────────────────────────────────┴─────────────┘
```

1. **TDD → impl** (implementer): for each AC, a failing test first (watch it fail for the
   expected reason), least code to pass, refactor (`.claude/rules/tdd.md`). Unit and
   integration tests touched by the change green; commit on `pbi/<N>`; report the diff range
   `origin/main...pbi/<N>` and the TDD record.
2. **Review** (Director): spawn `code-reviewer` and `security-reviewer` **in parallel, in one
   message**, each given only: issue number, worktree path, slot, diff range. Never pass the
   implementer's summary. Wait for both.
   - Verify every finding yourself (open the line; reproduce). Real → SendMessage the
     implementer to fix it test-first. Wrong → reject with evidence in the record.
   - After any code change, **new** reviewers (both) on the new range. Repeat until both
     return `APPROVE`. Three rounds without approval → have the implementer reset to the last
     green commit and split the change smaller; keep going, do not ask the user.
3. **E2E** (implementer): Playwright scenarios for every screen-observable AC, against the app
   on its slot port; green. A failure is a bug → back to step 1 (failing test first), then
   step 2 again.
4. **Verify** (implementer, then Director): the full verify command exits 0 in the worktree.
   The Director then checks each AC by its 確認方法 and each DoD item against evidence (run
   checks through `check-runner` / captured logs, not raw output). Anything unmet → back to
   step 1. **Tick each AC's checkbox on the issue as soon as it holds on evidence (ADR-0048)** —
   an unticked AC means "not verified". If the test an AC names was renamed, fix the 確認方法
   in the issue first (dated note at the top of the body), then tick.
   **Check the evidence (ADR-0065):** of the `rc=` line and the result line in a report, the ones
   that decide an AC are not taken on trust: the Director re-runs it or opens the log and
   compares. A check the report marks `未実行` is not evidence.

Bugs found anywhere in the loop are fixed inside the PBI, test-first. Adjacent improvements
are filed as new PBIs, not folded in.

## 4. Integration (Director, one PBI at a time)

**When the user asked for a PR (ADR-0017):** replace `main` / `origin/main` below with the
milestone's integration branch `m<N>/<slug>` (worktrees are cut from it, PBIs fast-forward into
it, it is pushed after every merge). Issues get their DoD ticked and the comment, but are not
closed: the single draft PR to `main` lists `Closes #N` for each and is updated after every PBI
and EPIC test. The user merges. When the integration branch is created, the Director runs
`git config insta.integrationBranch m<N>/<slug>` in the main checkout so the SessionStart
`ci-gate` hook (ADR-0067) checks that branch.

1. `git -C .worktrees/pbi-<N> rebase origin/main` (after `git fetch`). If the rebase changed
   anything, re-run verify in the worktree; green from before the rebase does not carry over.
2. In the main checkout: `git merge --ff-only pbi/<N>`, `git diff --check origin/main..HEAD`,
   `git push origin main`; confirm `git status -sb` shows no `ahead`. Do not push the next
   integration until the CI run of this push has **completed**: a newer push cancels the running
   one, and on 2026-11-21 six consecutive pushes left the gate with no completed run at all.
   After the push, `node scripts/ci-gate.mjs <integration branch>` exits 0 before the next one.
3. On the issue: confirm every AC box is ticked (§3 step 4), tick DoD, comment with the commit SHA, the verify result and the review
   verdicts; close; tick it in the EPIC.
4. Clean up by exact name. **First** `node scripts/slot.mjs drop <N>` in the worktree: it stops
   whatever listens on the slot's port `3100 + N` (children included) and deletes the D1 files and
   the bucket. Read its "止めたプロセス" line (`slot N のポート 310N のプロセスを M 個止めました`);
   exit 1 means a process would not die (its PID is printed): fix that before going on. Then
   `git worktree remove .worktrees/pbi-<N>`, `git branch -d pbi/<N>`, free the slot, and
   re-evaluate the ready set (§2). A server stopped by hand is not enough: `pnpm start` leaves
   `workerd` behind (#83).

## 5. EPIC integrated test — in a real browser (ADR-0012)

When the last child PBI of an EPIC is closed, the EPIC is **not** closed yet:

1. Create `.worktrees/epic-<N>` (branch `epic-test/<N>` from `origin/main`), take a free slot and
   reset it. Only one EPIC test runs at a time: the real Chrome is a shared resource.
2. Spawn `epic-tester` (`model: "sonnet"`, `ALLOW_COMMIT=true`, contract paste block). It drives
   **real Chrome through the chrome-devtools MCP** — headless Playwright never counts as the
   integrated test. If the MCP's Chrome is unavailable (e.g. another session holds its profile),
   it drives a headed Google Chrome with a throwaway profile over CDP instead (Playwright
   `channel: 'chrome'`, `headless: false`; ADR-0045). Only if both fail does it return
   `BLOCKED`; then the Director runs the same test itself with the claude-in-chrome tools and
   writes the same report.
3. `PASS` → verify the report against the EPIC's AC (every AC has screenshots; console and
   network clean), integrate the report and evidence like a PBI (§4: rebase, ff-merge, push),
   tick each EPIC AC the report shows PASS, tick the EPIC's DoD, comment with the report link and
   SHA, close the EPIC.
4. `FAIL` → integrate the report anyway (the failure is evidence), file one bug PBI per root
   cause under the EPIC (`.claude/rules/issue-authoring.md`), deliver them through §3, then
   rerun the whole integrated test on the new `main`. Repeat until `PASS`.
5. **Retest after later changes (ADR-0048).** Once an EPIC has passed, any change integrated
   afterwards that touches code behind that EPIC's screens (a refactor or `/simplify` included)
   reruns that EPIC's integrated test, with evidence, before the PR is handed over (marked ready
   for review). Every EPIC whose screens use a touched file is retested; verify and headless E2E
   do not substitute. Reports of reruns are suffixed `-r<N>`.

## 6. Never

- Close an issue, or hand over a PR containing one, with an unticked AC (ADR-0048).
- Close an issue with an unmet AC, a missing review approval, a skipped gate, or no E2E for a
  screen-observable AC.
- Close an EPIC without a `PASS` integrated test run in real Chrome whose report and screenshots
  are committed on `main`.
- Let a worker edit outside its worktree, touch another slot's data, or stop the shared stack.
- Weaken a gate, skip/only a test, or exclude code from coverage to finish.
- Ask the user mid-loop. Decide from the ADRs, or decide and write the ADR; report at the end.
  Only accounts, payments, secrets and publishing are held for the user.

The run's final report lists: issues closed (SHAs), review rounds per PBI, bugs fixed, ADRs
added (marking the ones the Director decided), anything held for the user.
