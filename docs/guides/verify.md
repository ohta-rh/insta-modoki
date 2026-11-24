---
type: Guide
title: verify の流し方
description: PBI の完了を判定する verify コマンドの手順・順番・終了コード、1 手順だけ流す方法、スロットのポートの渡し方。コードを変えたら最後に流す。
tags: [verify, testing]
status: stable
---

# verify の流し方

`pnpm verify`（中身は `node scripts/verify.mjs`）が、型検査から E2E までを下の順に流す（CI も同じコマンドを流す。「CI」の節）。1 つでも失敗したらそこで止める。PBI の「完了」は、`main` への rebase の後に verify が 0 で終わること（[ADR-0009](../adr/0009-tdd-review-e2e-verify-loop.md)、[ADR-0024](../adr/0024-verify-command-and-coverage-gate.md)）。

## 手順

手順は `scripts/verify.mjs` の `STEPS` が持ち、この表と同じ順・同じコマンドでなければならない（`scripts/verify.test.ts` が突き合わせる）。

| 名前 | コマンド | 失敗の意味 |
|---|---|---|
| `typecheck` | `pnpm typecheck` | TypeScript の型の誤り |
| `lint` | `pnpm lint` | ESLint の違反 |
| `format` | `pnpm format:check` | Prettier の形式に合っていないファイルがある |
| `docs` | `node scripts/check-docs.mjs docs` | `docs/` が OKF v0.3 の規則（下の「docs の検査」）に合っていない |
| `unit` | `pnpm exec vitest run --coverage --exclude "**/*.int.test.ts"` | 単体テストの失敗、または `src/**/model/**` と `src/shared/config/**` の行カバレッジが 80% 未満 |
| `integration` | `pnpm exec vitest run --passWithNoTests .int.test.ts --exclude src/shared/db/seed/seed.int.test.ts` | `seed.int.test.ts` を除く結合テストの失敗（`src/`・`scripts/`・`tests/` の `*.int.test.ts` が 1 つも無いときは `integration: テストなし` を出して成功） |
| `integration-seed` | `pnpm exec vitest run src/shared/db/seed/seed.int.test.ts` | seed の結合テスト（bench を含む）の失敗。共有の Garage に CopyObject を大量に投げるので、他の結合テストと重ねず後から流す（[ADR-0058](../adr/0058-seed-integration-test-runs-in-its-own-verify-step.md)） |
| `int-budget` | `node scripts/int-budget.mjs` | 変わった結合テストの 1 本が、単独で流して上限の 25% を超えた（`int-budget: FAIL <file> › <name> <最小>ms > <予算>ms（上限 <timeout>ms）`）。[結合テストの時間の予算](#結合テストの時間の予算) |
| `build` | `pnpm build` | OpenNext のビルドの失敗 |
| `e2e` | `pnpm e2e` | Playwright の失敗（ビルドの成果物を `pnpm start` で workerd に載せて開く） |
| `perf-budget` | `node scripts/perf/bundle.mjs` | `/` を最初に開いたときの初期 JS が gzip で 170,000 バイトを超えた（`perf: FAIL initialJsGzipBytes / <値> > 170000`）。[性能の基準](#性能の基準) |

## 使い方

- 全部流す: `node scripts/verify.mjs`
- 手順の一覧: `node scripts/verify.mjs --list`
- 1 手順だけ流す: `node scripts/verify.mjs --only unit`
- スロットのポートを渡す: `PORT=3101 node scripts/verify.mjs`（E2E の `webServer` と `start` がこのポートを使う。未設定は 3100。スロット N は `3100 + N`）

## 同時に流したとき・確かめた commit

[ADR-0062](../adr/0062-verify-runs-one-at-a-time-and-records-head.md): verify は同じマシンで一度に 1 つだけ走る。ロックは `$(git rev-parse --git-common-dir)/insta-verify.lock`（全ての worktree で同じファイル。中身は `{pid, head, worktree, startedAt}`）。

- 別の verify が生きていれば `verify: 別の verify（pid <N>、<worktree>）が終わるまで待ちます` を出し、10 秒ごとに見直して待つ（1 分ごとに待っている旨を出す）。60 分を超えたら `verify: 60 分待っても別の verify が終わりません` で 1 で終わる。
- pid が生きていないロックは `verify: 終わっていない verify（pid <N>）のロックを引き継ぎます` を出して引き継ぐ。
- 始めに `verify: HEAD <短い SHA> <ブランチ>` と `verify: load average <1 分値> / CPU <論理コア数>`（表示だけ）を出す。実行中に HEAD が動くと `verify: FAIL HEAD が実行中に <a> から <b> に変わりました` で 1 で終わる。通ると最後の行は `verify: OK <短い SHA>`（この SHA が確かめた commit）。
- 成功・失敗・SIGINT・SIGTERM でロックを外す。`--list` と不正な引数はロックを取らない。`--only` は取る。
- 死んだ verify のロックが残って止まって見えるときは、`$(git rev-parse --git-common-dir)/insta-verify.lock` を消してよい（pid が生きていないことを確かめてから）。

`perf-budget` も `build` の成果物を使う（アプリが `PORT` で動いていなければ自分で `pnpm start` を起動して止める）。

`e2e` は `build` の成果物を使うので、単独で流す前に `pnpm build` が要る。Chromium は初回に `pnpm exec playwright install chromium` で入れる。

E2E の用意の関数（`e2e/support/auth.ts` の `test`・`signedIn`・`freshUser` の fixture と `signInViaHarness`、`e2e/support/screens.ts` の `createWorld`）は、画面のサインアップを通らず、窓口 `/e2e-harness/db` の `seedSession` でユーザーとセッションの行を作り、返った cookie を `context.addCookies` で入れる（[ADR-0069](../adr/0069-e2e-signs-in-through-the-harness.md)）。画面のサインアップを使う（`signUpViaUi`）のは、サインアップ・ログイン・招待の画面を確かめる spec（`signup.spec.ts`・`login-logout.spec.ts`・`invite.spec.ts`）だけ。

## 結合テストの時間の予算

`int-budget`（[ADR-0059](../adr/0059-integration-tests-stay-within-a-quarter-of-their-timeout.md)）は、基準のコミット（`INT_BUDGET_BASE`、なければ `origin/$GITHUB_BASE_REF`・`origin/m*/*`・`origin/main` のうち、HEAD までの commit 数が一番少ない merge-base）から変わった `*.int.test.ts` を 1 本ずつ（`--no-file-parallelism`）流し、各テストの所要時間が、そのテストの上限（既定 5,000ms、`it(…, 60_000)` ならその値）の 25% 以下かを見る。超えたテストがあるファイルだけをもう 2 回流し、3 回の最小が 25% を超えたものを全て `int-budget: FAIL …` で出して 1 で終わる（ホストの混み具合は時間を延ばす方向にしか働かないため、最小で判定する）。直し方は、往復をまとめる（`t.db.batch`）・並べる（`Promise.all`）か、計測した時間を書いたコメントつきで個別の上限を付けること。vitest の既定の上限は変えない。

- 変わったファイルが無ければ `int-budget: 変わった結合テストなし` で 0。どの基準も見つからない（CI の浅い checkout など）ときは `int-budget: 基準のコミットが無いので全ての結合テストを測ります` を出して全部を測る。
- CI の verify の job は `actions/checkout` を `fetch-depth: 0` で取り、`origin/$GITHUB_BASE_REF` が手元にあるので、PR で変わった結合テストだけを測る（浅い取得だと全部を測り、job の上限 30 分を超える）。
- `node scripts/int-budget.mjs --all` で全部を測る。`src/shared/db/seed/seed.int.test.ts` と `scripts/slot.int.test.ts` は、どちらも計測した上限を持ち、測ると数分かかりバケットを触るので測らない。
- 結果は `node_modules/.cache/int-budget/results.json`（reporter `scripts/int-budget-reporter.mjs` が書く）。

## 性能の基準

基準は `scripts/perf/thresholds.mjs` の `THRESHOLDS`（[ADR-0046](../adr/0046-performance-budget-in-verify-and-ci.md)）: Lighthouse（モバイル）の点数 90 以上、LCP 2,500ms・INP 200ms・CLS 0.1・フィード API の p95 300ms・初期 JS（gzip）170,000 バイト以内。割れると `perf: FAIL <指標> <画面> <値> <|> <基準>` を出して 1 で終わる。

- `perf-budget`（既定の手順の最後）: `node scripts/perf/bundle.mjs`。速い。
- `perf`（`--with-perf` を付けたときだけ足される。`--list --with-perf` で見える）: `node scripts/perf/run.mjs`。遅い（Lighthouse 9 回・INP・フィード 220 回）。先に `pnpm build` と、スロットでの `pnpm seed:bench`（`SEED_DEMO_PASSWORD` を決めて渡す）が要る。`node scripts/verify.mjs --only perf --with-perf` で単独で流す。結果は `perf-results/*.json`（git に入れない）。他のスロットの重い処理が動いていないときに流す。
- CI は `main` への push のときだけ job `perf` で後者を流す。

## docs の検査

`node scripts/check-docs.mjs [<root>]`（既定は `docs`）が [`.claude/rules/documentation.md`](../../.claude/rules/documentation.md) の規則を検査する（[ADR-0027](../adr/0027-ci-runs-verify-and-docs-check.md)）。エラーは 1 行ずつ `<root からの相対パス>: <メッセージ>`、最後に `check-docs: <n> 件のエラー`（終了コード 1）。全て通れば `check-docs: OK (<n> 件の文書)`（0）。

- コンセプトの文書に `type`・`title`・`description` があり、`type` が `docs/index.md` の「type の一覧」にある（`missing type` / `missing title` / `missing description` / `unknown type <名前>`）
- サブディレクトリの `index.md` と `log.md` に frontmatter が無い（`reserved file must not have frontmatter`）
- ルートの `index.md` の `okf_version` が文字列 `"0.3"`（`okf_version != "0.3"`）
- frontmatter が閉じている（`unterminated frontmatter`）、トップレベルのキーが重複しない（`duplicate key <キー>`）、値が空のキーが無い（`empty value for <キー>`。次の行が字下げの塊なら除く）
- 相対と `/` 始まりのリンク先が存在する（`broken link <リンク>`。`https:` などの外部のリンクと `#` だけのリンクは見ない）、wikilink が無い（`wikilink`）。コードブロックとインラインコードの中は見ない

依存を足さないため、トップレベルの `key:` の行だけを読む。入れ子の YAML の文法の誤りは検出しない。

## CI

`.github/workflows/ci.yml` の job `verify` が、`main` への push と pull request で動く（job `perf` は `main` への push のときだけ。「性能の基準」）。`docker compose up -d --wait`（Garage だけ）→ `node scripts/slot.mjs prepare 0` → `pnpm exec playwright install --with-deps chromium` → `PORT=3100 SLOT_INT=1 node scripts/verify.mjs` を流し、失敗したら `playwright-report` を残す。失敗した E2E のトレース（操作・DOM・ネットワーク）は `playwright-report` の中にあり、ダウンロードして `pnpm exec playwright show-report <dir>` で開き、失敗したテストの「Traces」から見る。使う action は 40 桁の commit SHA で固定する（[ADR-0027](../adr/0027-ci-runs-verify-and-docs-check.md)）。

## 出力と終了コード

手順ごとに `verify: <名前> ...` と `verify: <名前> OK` を出し、失敗したら `verify: FAIL <名前>`、全て成功したら最後の行が `verify: OK`。

| 終了コード | 意味 |
|---|---|
| 0 | 全て成功 |
| 失敗した手順のコマンドの終了コード（0 や不明のときは 1） | その手順の失敗。後の手順は流さない |
| 2 | 引数の誤り（存在しない手順は `verify: 不明な手順: <名前>`） |

## 手順を足す

後の PBI は `STEPS` に 1 行足し、この表にも同じ行を足す。
