---
type: TestReport
title: EPIC #1 開発基盤の総合試験（3 回目、PASS）
description: 統合ブランチ m1/local-mvp の 4e8191b で、EPIC #1 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）とコマンドで確かめ直し、#83（スロットの drop・reset がサーバーを止める）も実際に確かめた。全て PASS。
tags: [epic-test]
---

# EPIC #1 開発基盤の総合試験（3 回目）

## 対象

- EPIC: [#1](https://github.com/ohta-rh/insta-modoki/issues/1)（子 PBI #18・#19・#20・#22・#23・#24・#25・#72・#78・#83）
- 試験した commit: `4e8191b`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 2（アプリ `http://localhost:3102`）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md) によるやり直し。2 回目（[r2](epic-0001-dev-foundation-r2.md)、PASS）の後に #78（テストごとの時間切れ）と #83（`1602b57..4e8191b`。`node scripts/slot.mjs drop|reset <N>` が先にポート `3100 + N` で待ち受けるプロセスと、`--port` が合う親を止める）が統合された

### ブラウザの操作の方法

[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) の第 2 の手段。chrome-devtools の MCP は 2 回とも `The browser is already running for .../chrome-devtools-mcp/chrome-profile` で開けなかった。そこで使い捨てのプロファイルで Google Chrome（`channel: 'chrome'`、`headless: false`）を起動し、CDP で操作した。幅は `page.setViewportSize` で 1280・768・375px にした。同梱の Chromium とヘッドレスは使っていない。データはサインアップの画面からだけ作った（パスワードは実行時に生成し、記録していない）。項目ごとのデータは [summary.json](evidence/epic-0001-r3/summary.json) にある。

## 結果

PASS（7 つの受け入れ条件の全てが満たされ、#83 の実地の確認も通った）

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `pnpm build`（終了 0）→ `PORT=3102 pnpm start`。未ログインで `/` を開き、UI からサインアップして `/` を 1280・768・375px で開く。固定の `nav` を外接の矩形と computed style で調べた | PASS。未ログインの `/` は `/accounts/login` に移る（失敗の経路）。1280・768px は左のサイドナビ（`position: sticky`、x=0、幅 244px）に「ホーム・検索・投稿・通知・プロフィール」の 5 項目。375px は下のナビ（`position: fixed`、y=844、高さ 56px）に同じ 5 項目。どの幅でもフッターに「学習目的の非公式プロジェクトです。Meta 社とは関係ありません。」。横のスクロール無し（`scrollWidth` = `clientWidth`）。Tab は「本文へ移動」→ ホーム → 検索 → 投稿 → 通知 → プロフィールの順に届く | [1280](evidence/epic-0001-r3/ac1-home-1280.png)・[768](evidence/epic-0001-r3/ac1-home-768.png)・[375](evidence/epic-0001-r3/ac1-home-375.png)・[未ログイン](evidence/epic-0001-r3/ac1-visitor-redirect-1280.png) |
| AC-2 | スロット 2 で `PORT=3102 node scripts/verify.mjs`（始める前に負荷 6.7）。スロット 1 の `3101` は別のセッションが使っているため、2 スロットの同時実行は今回やり直していない。2 回目の PASS（スロット 3 と 4、同時）の後に、スロットの分離を変える変更は無い（#83 は `scripts/slot.mjs` の後片付けだけ） | PASS（1 スロットでの実行。同時実行の証拠は r2 を引き継ぐ）。終了 0、204 秒。typecheck / lint / format / docs / unit / integration / build / e2e（150 件）/ perf-budget が全て OK で、最後は `verify: OK` | [verify-slot2.txt](evidence/epic-0001-r3/verify-slot2.txt)・[終了コード](evidence/epic-0001-r3/verify-slot2.rc)。同時実行は [r2](evidence/epic-0001-r2/ac2-concurrent-verify.txt) |
| AC-3 | `gh run list --branch m1/local-mvp --workflow ci.yml` | PASS。`4e8191b` の実行 [44991526600](https://github.com/ohta-rh/insta-modoki/actions/runs/44991526600) が `success`。直近 6 件が全て `success` | 実行の URL |
| AC-4 | 1 回目の証拠を引き継ぐ（この回は PR を作っていない） | PASS。PR #70（落ちるテスト）は実行 [44853230180](https://github.com/ohta-rh/insta-modoki/actions/runs/44853230180)、PR #71（存在しない文書へのリンク）は実行 [44908875510](https://github.com/ohta-rh/insta-modoki/actions/runs/44908875510) で、どちらも `failure`。2 回目の後に `.github/workflows/ci.yml` は変わったが、足されたのは push のときだけ動く `perf` ジョブ（ADR-0046）で、`verify` ジョブと docs の検査は変わっていない（`git diff 20d04dd 4e8191b -- .github`） | 実行の URL |
| AC-5 | `pnpm exec vitest run src/shared/db/schema.int.test.ts -t "同じ利用者が同じ投稿に 2 回いいねすると拒まれる"` | PASS。1 件が通った（終了コード 0） | [ac5-named-test.txt](evidence/epic-0001-r3/ac5-named-test.txt) |
| AC-6 | Chrome の中で `fetch` して `/`・`/does-not-exist`・`/brand/favicon.svg`・`/nope.png`・`/favicon.ico`・`/_next/static/nope.js` の応答ヘッダーを読み、`/favicon.ico` と `/_next/static/nope.js` は画面の遷移でも確かめた。`e2e/security-headers.spec.ts`（差し込みの試験を含む 4 件）は verify の e2e の中で通った | PASS。6 つ全てに CSP（`frame-ancestors 'none'` を含む）・`X-Content-Type-Options: nosniff`・`Referrer-Policy: strict-origin-when-cross-origin`・`Permissions-Policy` が付く。既存の静的ファイル `/brand/favicon.svg` の CSP に `nonce-` は無く、他の 5 つには付く | [summary.json の `headers` と `nav`](evidence/epic-0001-r3/summary.json)・[`/favicon.ico` の 404](evidence/epic-0001-r3/ac6-favicon-404-1280.png)・[verify-slot2.txt](evidence/epic-0001-r3/verify-slot2.txt) |
| AC-7 | [stack-selection.md](../research/stack-selection.md) を開いた | PASS。8 つの層（フレームワーク・DB・ORM・認証・UI・テスト・ランタイムとパッケージ管理・画像の配信）の比較の節と、「AC-4〜AC-7」の節に workerd での試作の記録がある | 文書 |

## #83 の実地の確認（`node scripts/slot.mjs drop|reset`）

[ac83-slot-drop.txt](evidence/epic-0001-r3/ac83-slot-drop.txt) に全ての出力がある。

| 確認 | 結果 |
|---|---|
| ビルド → `PORT=3102 pnpm start` の後、`lsof -ti tcp:3102` | 待ち受けは PID 10401 の 1 つ。このワークツリーのプロセスは 6 つ（親の `pnpm`・`opennextjs-cloudflare`・`wrangler`・`workerd` など） |
| `node scripts/slot.mjs drop 2` | `slot 2 のポート 3102 のプロセスを 5 個止めました`、続いて `slot 2 を削除しました（insta-s2、.wrangler/state）。.dev.vars は残しています`。終了 0 |
| その後の `lsof -ti tcp:3102` | 何も出ない |
| その後に、このワークツリーのプロセスが残るか | 残らない。`pgrep -f .worktrees/epic-1/` が 1 件を出したが、それは `pgrep` を呼んだシェル自身（コマンド行に同じ文字列を含む）だった。最後の確認（下）は何も出ない |
| `.wrangler/state` | 無くなっている |
| `node scripts/slot.mjs prepare 2` | `slot 2 を準備しました（insta-s2、PORT=3102、.dev.vars）`。終了 0 |
| `node scripts/slot.mjs drop 7` | `slot は 0〜4 の整数です`。終了 2。何も止めず、何も消さなかった（直後も 3100 の PID 87129 は生きていて、3101・3103・3104 は元から空） |
| 自分の側のプロセスを巻き込まない | スクリプトを呼んだシェル・親の `claude`・PID 1 は止まらず、drop は最後まで走って終了 0 になった |

## ブラウザの状態

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| 未ログインの `/`（→ ログイン） | 0 | 0 |
| サインアップ | 0 | 0 |
| `/`（1280・768・375px、再読み込みを含む） | 0 | 0 |
| AC-6 の取得（わざと開いた 404 が 3 つ） | 4（全て、わざと開いた 404 の `Failed to load resource: 404`） | 0（404 の応答 3 つを除く） |
| AC-6 の遷移（`/favicon.ico`・`/_next/static/nope.js`） | 2（同上） | 4 件。画面の遷移で中断された直前のページの取得で、サーバーの失敗ではない（r2 と同じ） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `pnpm build` | 0 |
| `PORT=3102 node scripts/verify.mjs`（スロット 2、子 PBI の E2E を全て含む。e2e 150 件通過） | 0 |
| `pnpm exec vitest run src/shared/db/schema.int.test.ts -t "…"`（AC-5） | 0 |
| `node scripts/slot.mjs drop 7` | 2（期待どおり） |

## 後片付け

[cleanup.txt](evidence/epic-0001-r3/cleanup.txt): 最後の `node scripts/slot.mjs drop 2`（サーバーは verify が既に止めていた）は「プロセスを 0 個止めました」、終了 0。`lsof -ti tcp:3102` は何も出さず、`pgrep -f .worktrees/epic-1/` も何も出さない。

## 見つけた問題

なし。補足: `node scripts/slot.mjs drop 2` は、バケットの削除に 1〜2 分かかる（遅いが失敗ではない）。
