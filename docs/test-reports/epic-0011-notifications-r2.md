---
type: TestReport
title: EPIC #11 通知の総合試験（2 回目）
description: ADR-0048 によるやり直し。#85・#86・#84 の後の 5807758（アプリのコードは 80aa192 と同じ）で、EPIC #11 の 5 つの受け入れ条件と #86 のバッジの位置・クリック・名前を実ブラウザ（Google Chrome 157）で確かめた。全て満たし、PASS。
tags: [epic-test]
---

# EPIC #11 通知の総合試験（2 回目）

## 対象

- EPIC: [#11](https://github.com/ohta-rh/insta-modoki/issues/11)。1 回目: [epic-0011-notifications.md](epic-0011-notifications.md)（19648d3、PASS）
- やり直しの理由（[ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)）: 1 回目の後に #86 がナビの未読バッジのマークアップ（バッジをリンクの外、`pointer-events-none`、リンクの名前は「通知（未読 N 件）」）を、#84 がストーリーのビューアを、#85 が E2E の共有アカウントへの未読の漏れを変えた
- 試験した commit: `5807758`（統合ブランチ `m3/phase2` から切った `epic-test/11`。アプリのコードは `80aa192` と同じ。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)）
- 日付: 2026-11-22
- スロット: 2（`http://localhost:3102`、`pnpm build` → `PORT=3102 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s2`、空の D1）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` の画面ありの Google Chrome を使い捨てのプロファイルで起こして操作した。A・B・C は別々のブラウザ文脈で、サインアップ・いいね・コメント・フォロー・通知の操作は UI で行った。
- データ: A の投稿 18 件・B の投稿 2 件と AC-4 の古い通知はアプリ自身の E2E ハーネス `/e2e-harness/db`（[ADR-0041](../adr/0041-e2e-setup-writes-go-through-the-app.md)）で入れた。D1 の読み取りは `node:sqlite`。
- 記録: [summary.json](evidence/epic-0011-r2/summary.json)（axe・Tab の順・ブラウザの状態・SSE・#86 の寸法）、[run-checks.txt](evidence/epic-0011-r2/run-checks.txt)（全チェックの出力）

## 結果

PASS。AC-1〜AC-5 と #86 の 3 点（バッジの位置・バッジを押すと開く・名前に見えている文字が含まれる）を全て満たした。コンソールのエラー・警告と失敗した通信は、起こした分（オフライン、配信の遮断、未ログインの配信）を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | A が `/` を開いたまま、B が A の投稿にいいね（6 回、押す時刻を 1.5〜4.5 秒の乱数でずらす）。B の押した時刻から A のナビの名前が「通知（未読 1 件）」に変わるまでを MutationObserver で測る。1 回目は通知の画面を開く。失敗の経路: 未ログインで配信を開く | PASS。6 回は 2,503 / 548 / 975 / 966 / 551 / 391 ms で全て 5 秒以内。通知の画面に「B さんがあなたの投稿にいいねしました（新着）」が出て、開くとバッジが消え DB の未読が 0。未ログインの配信は 401 の JSON | 前 [1280](evidence/epic-0011-r2/ac1-a-before-1280.png)・[768](evidence/epic-0011-r2/ac1-a-before-768.png)・[375](evidence/epic-0011-r2/ac1-a-before-375.png)。バッジ [1280](evidence/epic-0011-r2/ac1-a-badge-1280.png)・[768](evidence/epic-0011-r2/ac1-a-badge-768.png)・[375](evidence/epic-0011-r2/ac1-a-badge-375.png)。B [1280](evidence/epic-0011-r2/ac1-b-liked-1280.png)・[768](evidence/epic-0011-r2/ac1-b-liked-768.png)・[375](evidence/epic-0011-r2/ac1-b-liked-375.png)。一覧 [1280](evidence/epic-0011-r2/ac1-a-list-1280.png)・[768](evidence/epic-0011-r2/ac1-a-list-768.png)・[375](evidence/epic-0011-r2/ac1-a-list-375.png) |
| AC-2 | B が 130 字のコメントとフォロー。B は自分の投稿にいいねとコメント（失敗の経路）。A が一覧を開き、行を押す | PASS。新しい順でフォロー、コメント。コメントは先頭 100 字と「…」。行は `/p/<投稿>`・`/e11_b` へ移る。B 宛ての通知は 0 行 | 一覧 [1280](evidence/epic-0011-r2/ac2-a-list-1280.png)・[768](evidence/epic-0011-r2/ac2-a-list-768.png)・[375](evidence/epic-0011-r2/ac2-a-list-375.png)。B の自分の投稿 [1280](evidence/epic-0011-r2/ac2-b-own-post-1280.png)。移った先 [投稿](evidence/epic-0011-r2/ac2-a-post-opened-1280.png)・[プロフィール](evidence/epic-0011-r2/ac2-a-profile-opened-1280.png)（768・375 も同名で同じ場所） |
| AC-3 | (a) DevTools の Offline で A を切り B がいいね。(b) Offline とタブを隠すで B が 2 件いいね、戻して測る。(c) 配信 `/api/notifications/stream` を abort で塞ぎ B がいいね（3 回）。(d) 配信の接続を 135 秒見る | PASS。(a) 既に開いた配信は生き続け切断中にバッジ 1、戻した後も DB と同じ 1（Chrome の Offline は新しい要求だけを止める。1 回目と同じ）。(b) 切っている間バッジ 0（DB は 2）、戻して 14 ms で 2、4 秒後も 2。(c) 5,770 / 6,484 / 6,283 ms（10 秒以内）。(d) 接続は 60,013 / 60,016 ms で閉じ、続けて新しい接続が開いた | [Offline のみ](evidence/epic-0011-r2/ac3-a-devtools-offline-1280.png)・[Offline と隠す](evidence/epic-0011-r2/ac3-a-offline-hidden-1280.png)・[復帰後](evidence/epic-0011-r2/ac3-a-recovered-1280.png)・[配信を塞いだ](evidence/epic-0011-r2/ac3-a-sse-blocked-badge-1280.png)（各 768・375 も同名） |
| AC-4 | 91 日前・1 日前・89 日前の like の通知を A 宛てに入れ、一覧を開いてから `pnpm jobs:run notification-cleanup`。再実行と存在しない名前（失敗の経路） | PASS。終了コード 0、`deleted=1`。91 日前の 1 件だけが消え（17 → 16 件）、一覧からも消えた。再実行は 0 で何も消さず、存在しない名前は終了コード 2 | 前 [1280](evidence/epic-0011-r2/ac4-a-before-job-1280.png)・[768](evidence/epic-0011-r2/ac4-a-before-job-768.png)・[375](evidence/epic-0011-r2/ac4-a-before-job-375.png)、後 [1280](evidence/epic-0011-r2/ac4-a-after-job-1280.png)・[768](evidence/epic-0011-r2/ac4-a-after-job-768.png)・[375](evidence/epic-0011-r2/ac4-a-after-job-375.png)。ログ [run](evidence/epic-0011-r2/ac4-job-run.txt)・[rerun](evidence/epic-0011-r2/ac4-job-rerun-and-bad-name.txt) |
| AC-5 | B のセッションで `/notifications` と配信の最初のイベントを開く（`userId=<A>` を付けても）。A が B の投稿にいいねして B の 1 件を確かめる。A の一覧で Tab と Enter。axe（WCAG 2.2 AA）を未読ありのホーム・A の一覧・B の一覧・空の一覧 × 1280・375。未ログインで `/notifications` | PASS。B の一覧は空でバッジなし、配信の最初のイベントは `{"unreadCount":0}`（query を付けても同じ）。B の 1 件は A のいいねだけ。Tab は 16 行の全てへ届き、Enter で移る。axe の重大・深刻な違反は 8 画面で 0 件（未読があるホームを含む）。未ログインは `/accounts/login` へ | B の空 [1280](evidence/epic-0011-r2/ac5-b-empty-1280.png)・[768](evidence/epic-0011-r2/ac5-b-empty-768.png)・[375](evidence/epic-0011-r2/ac5-b-empty-375.png)。B の一覧 [1280](evidence/epic-0011-r2/ac5-b-list-1280.png)。A の一覧 [1280](evidence/epic-0011-r2/ac5-a-list-1280.png)・[768](evidence/epic-0011-r2/ac5-a-list-768.png)・[375](evidence/epic-0011-r2/ac5-a-list-375.png)。空 [1280](evidence/epic-0011-r2/ac5-c-empty-1280.png)。未ログイン [1280](evidence/epic-0011-r2/ac5-anon-redirect-1280.png) |
| #86 | 未読 1 件のとき、1280・768・375 でバッジとリンクの矩形、バッジが `<a>` の外か、リンクの名前、ナビの読み上げの木を測る。バッジの数字の矩形の中心をマウスで押す（1280 と 375） | PASS。バッジはリンクの矩形の中に収まり（1280・768: リンク x 12〜231 の右端、バッジ x 199〜219。375: リンクの右上、バッジ x 266.5〜286.5・y 762.5〜782.5）、`<a>` の外で `pointer-events: none`。名前は「通知（未読 1 件）」で見えている「通知」を含み、ナビの木にリンクの外の「1」は出ない。バッジの中心を押すと 1280・375 とも `/notifications` に移った（開いた後の未読は 0）。axe に `label-content-name-mismatch` は出ない | バッジ [1280](evidence/epic-0011-r2/ac1-a-badge-1280.png)・[375](evidence/epic-0011-r2/ac1-a-badge-375.png)。押した後 [1280](evidence/epic-0011-r2/ac1-a-list-1280.png)・[375](evidence/epic-0011-r2/ac1-a-list-after-badge-click-375.png)。375 のナビの測定 [b86-375-main-nav.txt](evidence/epic-0011-r2/b86-375-main-nav.txt)・[写真](evidence/epic-0011-r2/b86-375-bottom-nav-badge.png) |

### 試験の道具の不具合（製品ではない）

本走の 375 px の #86 の測定 1 件が FAIL と記録された（[run-checks.txt](evidence/epic-0011-r2/run-checks.txt) の `FAIL 86 unread1 375px`）。矩形・名前・`<a>` の外の 3 条件は満たし、落ちたのは「ナビの読み上げの木にリンクの名前がある」の判定だけで、原因は試験の道具が `nav:visible` の先頭として下のナビではなく「ストーリー」のナビを選んだこと（[summary.json](evidence/epic-0011-r2/summary.json) の `b86-unread1` の 375 の `snap` がストーリーのナビ）。同じ測定を `getByRole('navigation', { name: 'メイン' })` で新しい利用者（D、未読 1 件）に対して 375 px でやり直し、通った（[b86-375-main-nav.txt](evidence/epic-0011-r2/b86-375-main-nav.txt)）。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0011-r2/summary.json) の `health`）。配信の要求は開いたままが期待で、ページ移動での中断（`ERR_ABORTED`）は `sse` に分け、失敗には数えていない。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ、フィード、投稿詳細、通知の一覧（A・B・空）、プロフィール、コメント・フォロー、ジョブの前後、キーボード、axe、135 秒の観察、#86 の追加測定 | 0 | 0 |
| AC-1 の失敗の経路（未ログインの配信） | 0 | 401 応答 1 件（想定） |
| AC-3 の Offline | 画像 `w640.webp` の `net::ERR_INTERNET_DISCONNECTED` 各 1 件（起こした切断） | 同じ画像の GET 各 1 件 |
| AC-3 の配信を塞いだ手順 | 配信の `net::ERR_FAILED` 15 件（abort で塞いだ分） | 0 |

キーボード: Tab の順（[summary.json](evidence/epic-0011-r2/summary.json) の `tabOrder.notifications`）は、ナビの後に一覧の 16 行が上から順に届く。

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3102 node scripts/verify.mjs`（スロットを `reset 2` で空にして）。typecheck・lint・format・docs・unit 590・integration 370（4 件は想定の skip）・build・e2e・perf-budget が全て OK（[verify.txt](evidence/epic-0011-r2/verify.txt)） | 0 |

子 PBI の E2E（`e2e/notifications.spec.ts`、`e2e/notifications-realtime.spec.ts`、`e2e/notification-badge-a11y.spec.ts`、ジョブの試験）は verify の e2e・unit・integration に含まれ全て通った。

## 見つけた問題

なし。観察は 1 回目と同じ 2 点（DevTools の Offline は開いている SSE を切らない。配信を塞ぐと再接続の失敗が `ERR_FAILED` として出る）で、AC の不合格ではない。
