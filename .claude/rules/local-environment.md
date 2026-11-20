# Local environment — one shared compose stack, a slot per worktree (ADR-0006, ADR-0008)

Milestone 1 runs only on the developer machine with `docker compose`. The deploy target is
Cloudflare (ADR-0011), so local services stand in for Cloudflare ones (e.g. S3-compatible
storage for R2). Concrete images and versions are chosen (with ADRs) by the Milestone 1 PBI that
adds `compose.yaml`; this rule fixes how worktrees share it.

## Shape

- **One compose project** named `insta-modoki` (fixed `name:` in `compose.yaml`), started from
  the main checkout. It runs the server-type backing services the stack needs locally (e.g. a
  database server, S3-compatible storage standing in for R2). The full app can also run in
  compose for "it runs locally" checks.
- **File-based local state** (e.g. a local D1/SQLite file, `.wrangler/state`) lives inside each
  worktree, is git-ignored, and is already isolated — it needs no slot name, only a reset at
  dispatch.
- **Worktrees never start their own stack.** They run the app, unit/integration tests and
  Playwright on the host, pointed at the shared services through their slot's env file.
- **Only the Director** starts, stops, upgrades or resets the shared stack. Workers must not run
  `docker compose down`, `-v`, `restart`, or edit containers.

## Slots

The Director assigns each in-flight PBI a slot `N` in `1..4` (`0` = the main checkout):

| Resource | Slot `N` |
|---|---|
| App port | `3000 + N` (main = 3000) |
| Database | `insta_s<N>` (app / E2E), `insta_s<N>_test` (integration tests) |
| Object storage bucket | `insta-s<N>` |
| Env file | `<worktree>/.env.local`, generated from the slot; never committed |

- Test runners that need parallel isolation inside one slot add a suffix per worker
  (`insta_s<N>_test_<worker>`), never reuse another slot's names.
- At dispatch and at cleanup the Director drops and recreates the slot's databases and bucket,
  so each PBI starts empty and leaves nothing behind.
- Until a slot script exists, these steps are done by hand exactly as above; the PBI that adds
  `compose.yaml` also adds the script that prepares and resets a slot, and this rule is
  updated to name it.

## Changing the shared stack

A PBI that changes `compose.yaml` or service configuration affects every slot, so it runs alone
in its wave (`.claude/rules/issue-authoring.md` §3). The Director applies the change to the
running stack after that PBI is merged, before dispatching the next wave.
