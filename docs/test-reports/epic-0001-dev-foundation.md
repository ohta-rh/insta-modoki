---
type: TestReport
title: EPIC #1 開発基盤の総合試験（1 回目、FAIL）
description: 統合ブランチ m1/local-mvp の f50238c で、EPIC #1 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）とコマンドで確かめた。AC-6 が満たされず FAIL。原因は src/proxy.ts の matcher で、バグの PBI #72 を起票した。
tags: [epic-test]
---

# EPIC #1 開発基盤の総合試験（1 回目）

## 対象

- EPIC: [#1](https://github.com/ohta-rh/insta-modoki/issues/1)（子 PBI #18・#19・#20・#22・#23・#24・#25）
- 試験した commit: `f50238c`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-21
- スロット: 3（アプリ `http://localhost:3103`、画像 `http://insta-s3.web.localhost:3912`）。AC-2 だけスロット 3 と 4
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 試験した人: Director（main セッション）

### ブラウザの操作の方法

- `epic-tester` は chrome-devtools の MCP の Chrome のプロファイルを開けず（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）、`BLOCKED` を返した。そのプロファイルは、このリポジトリと関係の無い別のセッションの Chrome が使っていたため止めていない。
- そのため `.claude/rules/delivery.md` §5 のとおり Director が試験した。
  - **利用者の Chrome（claude-in-chrome）**: 表示の幅は 1440px（倍率 90%）。画面の骨格・コンソール・ネットワークを確かめた。
  - **使い捨てのプロファイルで起動した Google Chrome（画面あり）**: CDP で操作し、表示の幅を 1280・768・375px に変えて写真を撮った。Playwright の `channel: 'chrome'`、`headless: false` で、chrome-devtools の MCP と同じく CDP で実物の Chrome を操作している。同梱の Chromium やヘッドレスのモードは使っていない。
- 項目ごとのデータ（幅・ナビの位置・コンソール・失敗した要求・応答ヘッダー）は [summary.json](evidence/epic-0001/summary.json) にある。

## 結果

FAIL（AC-6 が満たされない。他の 6 つは満たす）

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `node scripts/slot.mjs reset 3` → `pnpm build` → `PORT=3103 pnpm start`。未ログインで `/` を開き、UI からサインアップして `/` を 1280・768・375px で開く | PASS。1280・768px は左のサイドナビ（x=0、幅 244px）に「ホーム・検索・投稿・通知・プロフィール」の 5 項目。375px は下のナビ（y=756、高さ 56px）に同じ 5 項目。全ての幅でフッターに「学習目的の非公式プロジェクトです。Meta 社とは関係ありません。」。横のスクロールは無い。失敗の経路として、未ログインの `/` はログインの画面に移る | [1280](evidence/epic-0001/ac1-home-1280.png)・[768](evidence/epic-0001/ac1-home-768.png)・[375](evidence/epic-0001/ac1-home-375.png)・[未ログインの `/`](evidence/epic-0001/ac1-visitor-redirect-1280.png)・[利用者の Chrome、1440px](evidence/epic-0001/ac1-home-user-chrome-1440.jpg) |
| AC-2 | 2 つの worktree（スロット 3 と 4）で、`PORT=3103` と `PORT=3104` の `node scripts/verify.mjs` を同じ時刻（22:26:04）に始めた。ポートは [ADR-0037](../adr/0037-serve-local-media-from-garage-web-endpoint.md) の `3100 + N`（AC の文の 3001・3002 は古い値） | PASS。両方 0 で終わった（スロット 3 は 213 秒、スロット 4 は 220 秒）。8 つの手順が両方とも OK で、互いのデータを壊していない | [ac2-concurrent-verify.txt](evidence/epic-0001/ac2-concurrent-verify.txt) |
| AC-3 | 統合ブランチの最新の CI（`gh run list --branch m1/local-mvp --workflow ci.yml --limit 1`） | PASS。`f50238c` の実行 [44908162058](https://github.com/ohta-rh/insta-modoki/actions/runs/44908162058) が `success`（verify と docs の検査を含む） | 実行の URL |
| AC-4 | 落ちるテストを足した使い捨ての PR #70 と、存在しない文書へのリンクを足した使い捨ての PR #71 | PASS。どちらの CI も `failure`。#70 は実行 [44853230180](https://github.com/ohta-rh/insta-modoki/actions/runs/44853230180)（#22 のとき）、#71 は実行 [44908875510](https://github.com/ohta-rh/insta-modoki/actions/runs/44908875510)（`guides/verify.md: broken link does-not-exist-for-ci-check.md` → `verify: FAIL docs`）。両方とも閉じ、ブランチを名前で消した | 実行の URL |
| AC-5 | `pnpm exec vitest run src/shared/db/schema.int.test.ts -t "同じ利用者が同じ投稿に 2 回いいねすると拒まれる"` | PASS。1 件が通った | [ac5-named-test.txt](evidence/epic-0001/ac5-named-test.txt) |
| AC-6 | Chrome で `/`・`/does-not-exist`・`/brand/favicon.svg`・`/nope.png`・`/favicon.ico`・`/_next/static/nope.js` を取得して、応答ヘッダーを読んだ。`e2e/security-headers.spec.ts` は AC-2 の verify の中で通った | **FAIL**。`/favicon.ico` と `/_next/static/nope.js` の 404 には、CSP・`X-Content-Type-Options`・`Referrer-Policy`・`Permissions-Policy` が 1 つも付かない。どちらも Next.js の HTML の 404（`text/html`、スクリプトを含む）。他の 4 つには 4 つのヘッダーが付く。スクリプトの差し込みが実行されないことは E2E で確かめた | [summary.json の `headers`](evidence/epic-0001/summary.json)・[404 の画面](evidence/epic-0001/ac6-404-1280.png) |
| AC-7 | [stack-selection.md](../research/stack-selection.md) と ADR-0018〜0022 を開いた | PASS。「比較」の節に 8 つの層（フレームワーク・DB・ORM・認証・UI・テスト・ランタイムとパッケージ管理・画像の配信）、「試作の記録」の節に workerd での試作の記録（サインアップ・ログイン・署名付き PUT・ビルドの大きさ）がある | 文書 |

## ブラウザの状態

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| 未ログインの `/`（→ ログイン） | 0 | 0 |
| サインアップ | 0 | 0 |
| `/`（1280・768・375px） | 0 | 0 |
| `/`（利用者の Chrome、1440px） | 0 | 0（9 件、全て 200 か 304） |
| 存在しないパスの 404（わざと開いた） | 6（全て、わざと開いた 404 の読み込みの `Failed to load resource: 404`） | 0（わざと開いたものを除く） |

キーボード: AC-1 の画面のナビは全て `<a>` で、Tab で順にたどれる（ナビの骨格は #24 の E2E がキーボードと axe を確かめている）。

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（スロット 3、子 PBI の E2E を全て含む） | 0 |
| `PORT=3104 node scripts/verify.mjs`（スロット 4、同時） | 0 |
| CI（`f50238c`、実行 44908162058） | success |

## 見つけた問題

### 1. 存在しない静的ファイルの 404 にセキュリティヘッダーが付かない（AC-6）

- 再現手順:
  1. `node scripts/slot.mjs reset 3`、`pnpm build`、`PORT=3103 pnpm start`
  2. `curl -s -D - -o /dev/null http://localhost:3103/favicon.ico`
- 期待: 404 で、CSP・`X-Content-Type-Options`・`Referrer-Policy`・`Permissions-Policy` が付く（`/nope.png` の 404 と同じ）
- 実際: `HTTP/1.1 404 Not Found`、`Content-Type: text/html; charset=utf-8`。4 つのヘッダーが無い。`/_next/static/nope.js` も同じ
- 根本原因: `src/proxy.ts` の `matcher`（`'/((?!_next/static|_next/image|favicon.ico).*)'`）がこれらのパスを除外している。ファイルが無いので `public/_headers` も効かない
- 対応: バグの PBI [#72](https://github.com/ohta-rh/insta-modoki/issues/72) を EPIC #1 の下に起票した。直った後に、この総合試験をやり直す
