---
type: TestReport
title: EPIC #1 開発基盤の総合試験（2 回目、PASS）
description: 統合ブランチ m1/local-mvp の 36da85b で、EPIC #1 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）とコマンドで確かめ直した。#72 の修正で AC-6 が満たされ、全て PASS。
tags: [epic-test]
---

# EPIC #1 開発基盤の総合試験（2 回目）

## 対象

- EPIC: [#1](https://github.com/ohta-rh/insta-modoki/issues/1)（子 PBI #18・#19・#20・#22・#23・#24・#25・#72）
- 試験した commit: `36da85b`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-21
- スロット: 3（アプリ `http://localhost:3103`）。AC-2 だけスロット 3 と 4
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 1 回目: [epic-0001-dev-foundation.md](epic-0001-dev-foundation.md)（FAIL、AC-6）

### ブラウザの操作の方法

[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) の第 2 の手段。chrome-devtools の MCP は、そのプロファイルを別のセッションの Chrome が使っていて（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）開けなかった。そこで使い捨てのプロファイルで Google Chrome（`channel: 'chrome'`、`headless: false`）を起動し、CDP で操作した。幅は `page.setViewportSize` で 1280・768・375px にした。同梱の Chromium とヘッドレスは使っていない。データはサインアップの画面からだけ作った（パスワードは実行時に生成し、記録していない）。項目ごとのデータ（ナビの位置・コンソール・失敗した要求・応答ヘッダー）は [summary.json](evidence/epic-0001-r2/summary.json) にある。

## 結果

PASS（7 つの受け入れ条件の全てが満たされた。1 回目の FAIL の AC-6 は、#72 で直った）

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `pnpm build` → `PORT=3103 pnpm start`。未ログインで `/` を開き、UI からサインアップして `/` を 1280・768・375px で開く。ナビは表示されている固定の `nav` を、外接の矩形と computed style で調べた | PASS。未ログインの `/` は `/accounts/login` に移る（失敗の経路）。1280・768px は左のサイドナビ（`position: sticky`、x=0、幅 244px）に「ホーム・検索・投稿・通知・プロフィール」の 5 項目。375px は下のナビ（`position: fixed`、y=844、高さ 56px）に同じ 5 項目。どの幅でもフッターに「学習目的の非公式プロジェクトです。Meta 社とは関係ありません。」。`scrollWidth` = `clientWidth`（横のスクロール無し）。Tab は「本文へ移動」→ ホーム → 検索 → 投稿 → 通知 → プロフィールの順に届く | [1280](evidence/epic-0001-r2/ac1-home-1280.png)・[768](evidence/epic-0001-r2/ac1-home-768.png)・[375](evidence/epic-0001-r2/ac1-home-375.png)・[未ログイン](evidence/epic-0001-r2/ac1-visitor-redirect-1280.png) |
| AC-2 | 2 つの worktree（スロット 3 と 4）で、`PORT=3103` と `PORT=3104` の `node scripts/verify.mjs` を同じ時刻（22:55:24）に始めた。始める前にアプリのサーバーを止め、`uptime` の負荷は 4.2 だった（30 未満）。ポートは [ADR-0037](../adr/0037-serve-local-media-from-garage-web-endpoint.md) の `3100 + N` | PASS。両方 0 で終わった（スロット 3 は 247 秒、スロット 4 は 256 秒）。`verify: typecheck / lint / format / docs / unit / integration / build / e2e` が両方とも OK で、最後は `verify: OK` | [ac2-concurrent-verify.txt](evidence/epic-0001-r2/ac2-concurrent-verify.txt) |
| AC-3 | `gh run list --branch m1/local-mvp --workflow ci.yml` | PASS。最新の `success` は `f50238c` の実行 [44908162058](https://github.com/ohta-rh/insta-modoki/actions/runs/44908162058)。それより新しい 5 つ（`138f9ef`〜`36da85b`、`20d04dd`）は push が続いたため `cancelled` か `in_progress` で、`failure` は無い。`.github/` は `f50238c` から変わっていない（`git diff f50238c 36da85b -- .github` は空）。追記（Director、統合の前）: 打ち切られていた変更を全て含む `20d04dd` の実行 [44911454985](https://github.com/ohta-rh/insta-modoki/actions/runs/44911454985) が `success` で終わった | 実行の URL |
| AC-4 | 1 回目の証拠を引き継ぐ（この回は PR を作っていない） | PASS。PR #70（落ちるテスト）は実行 [44853230180](https://github.com/ohta-rh/insta-modoki/actions/runs/44853230180)、PR #71（存在しない文書へのリンク）は実行 [44908875510](https://github.com/ohta-rh/insta-modoki/actions/runs/44908875510) で、どちらも `failure`。CI の定義（`.github/`）は 1 回目から変わっていない | 実行の URL |
| AC-5 | `pnpm exec vitest run src/shared/db/schema.int.test.ts -t "同じ利用者が同じ投稿に 2 回いいねすると拒まれる"` | PASS。1 件が通った（終了コード 0） | [ac5-named-test.txt](evidence/epic-0001-r2/ac5-named-test.txt) |
| AC-6 | Chrome の中で `fetch` して `/`・`/does-not-exist`・`/brand/favicon.svg`・`/nope.png`・`/favicon.ico`・`/_next/static/nope.js` の応答ヘッダーを読み、`/favicon.ico` と `/_next/static/nope.js` は画面の遷移でも確かめた。`e2e/security-headers.spec.ts`（差し込みの試験）は AC-2 の verify の e2e の中で通った | PASS。6 つ全てに CSP（`frame-ancestors 'none'` を含む）・`X-Content-Type-Options: nosniff`・`Referrer-Policy: strict-origin-when-cross-origin`・`Permissions-Policy` が付く（1 回目に付かなかった `/favicon.ico` と `/_next/static/nope.js` の 404 も付く）。既存の静的ファイル `/brand/favicon.svg` の CSP に `nonce-` は無く、他の 5 つには付く | [summary.json の `headers` と `nav`](evidence/epic-0001-r2/summary.json)・[`/favicon.ico` の 404](evidence/epic-0001-r2/ac6-favicon-404-1280.png) |
| AC-7 | [stack-selection.md](../research/stack-selection.md) を開いた | PASS。「アプリのフレームワーク・DB・ORM・認証・UI・テスト・ランタイムとパッケージ管理・画像の配信」の 8 つの層の比較の節があり、「AC-4〜AC-7」の節に workerd での試作の記録（`/` と `POST /spike/db`、サインアップとログイン、署名付き PUT、ビルドの大きさ）がある | 文書 |

## ブラウザの状態

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| 未ログインの `/`（→ ログイン） | 0 | 0 |
| サインアップ | 0 | 0 |
| `/`（1280・768・375px、再読み込みを含む） | 0 | 0 |
| AC-6 の取得（わざと開いた 404 が 3 つ） | 4（全て、わざと開いた 404 の `Failed to load resource: 404`） | 0（404 の応答 3 つを除く。画面の遷移で中断された取得が 4 件記録されたが、サーバーの失敗ではなく、直前のページの取得の中断） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（スロット 3、子 PBI の E2E を全て含む） | 0 |
| `PORT=3104 node scripts/verify.mjs`（スロット 4、同時） | 0 |
| `pnpm exec vitest run src/shared/db/schema.int.test.ts -t "…"`（AC-5） | 0 |

## 見つけた問題

なし。1 回目の問題（存在しない静的ファイルの 404 にセキュリティヘッダーが付かない）は [#72](https://github.com/ohta-rh/insta-modoki/issues/72) で直り、AC-6 で確かめた。
