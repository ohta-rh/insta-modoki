# insta-modoki

A web application that reproduces the UX and features of a photo-sharing SNS (Instagram) as
faithfully as possible, under its own brand: no Instagram/Meta name, logo, icons, fonts or
screenshots anywhere in the product (ADR-0003). The plan is the proposal in
`docs/proposal/` (PDF + HTML source). Documentation entry point: `docs/index.md`.

## Status

- No application code yet. **Deploy target: Cloudflare, free tier first (ADR-0011)** — this
  overrides the proposal's Vercel/Neon hosting. The rest of the proposal's stack is
  **proposed, not accepted**: the first design PBI of Milestone 1 records the accepted stack
  (database included: D1 vs PostgreSQL + Hyperdrive) as ADRs before anything is built.
- Milestone 1 runs locally on `docker compose` only (ADR-0006), but its code already respects
  the Workers runtime (no native modules, no filesystem writes, no long-lived process state).

## How work is done

| Step | Rule | In short |
|---|---|---|
| Plan | `.claude/rules/issue-authoring.md` | Milestone → EPIC → PBI, filed in that order; every issue has DoR / AC / DoD; dependencies and touch sets mapped so PBIs run in parallel |
| Deliver | `.claude/rules/delivery.md` | The main session is the Director; one `pbi-implementer` (sonnet) per PBI in its own worktree; TDD → impl → code-review → E2E → verify, looped until AC/DoD hold; Director merges to `main` and pushes |
| Review | `.claude/agents/code-reviewer.md`, `.claude/agents/security-reviewer.md` | Two independent read-only sonnet subagents per round, given only the issue and the diff range |
| Environment | `.claude/rules/local-environment.md` | One shared compose stack; each worktree gets a slot (ports, database, bucket) |
| Tests | `.claude/rules/tdd.md` | Red → green → refactor, one behavior at a time, the red recorded |
| Docs | `.claude/rules/documentation.md` | `docs/` is an OKF v0.3 bundle; decisions are ADRs in `docs/adr/`, superseded never edited |

## Standing rules

- **Decisions** about architecture, technology or a cross-cutting rule get an ADR in
  `docs/adr/` in the same commit. Read the existing ADRs before deciding; do not re-decide one.
- **Git:** work lands on `main` and is pushed (no PRs unless the user asks). Stage by explicit
  path, `git diff --check` before every push, never force-push.
- **The user's alone:** accounts, payments, secrets, publishing, and any change that weakens
  a gate. Everything else the Director decides, records, and reports.
- **Keep the harness current:** a new decision, recurring mistake or constraint changes the
  rule or agent file in the same commit, with its ADR. A mistake that happens twice becomes a
  check (script, hook, test), not a longer rule.
