---
type: TestReport
title: EPIC #11 通知の総合試験（1 回目）
description: 統合ブランチ m3/phase2 の 19648d3 で、EPIC #11 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。いいねから 5 秒以内（6 回の実測は 167〜3,026 ms）にバッジが増え、切断からの復帰と配信の遮断（ポーリング 5.4〜6.6 秒）、90 日の削除、他人の通知の非表示を満たし、PASS。
tags: [epic-test]
---

# EPIC #11 通知の総合試験（1 回目）

## 対象

- EPIC: [#11](https://github.com/ohta-rh/insta-modoki/issues/11)（子 PBI #50 一覧と未読バッジ、#58 SSE による配信、#59 90 日の日次削除）
- 試験した commit: `19648d3`（統合ブランチ `m3/phase2`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s1`、空の D1）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で画面ありの Google Chrome を使い捨てのプロファイルで起こして CDP で操作した。A と B（と空の状態用の C）は別々のブラウザ文脈（Cookie が別）で、サインアップ・いいね・コメント・フォロー・通知の操作は全て UI で行った。
- データ: A の投稿 18 件と B の投稿 2 件、AC-4 の古い通知（91 日前・89 日前・1 日前）は、アプリ自身の E2E ハーネス `/e2e-harness/db`（`insertPost`・`seedUser`・`seedNotification`。[ADR-0041](../adr/0041-e2e-setup-writes-through-an-app-harness-operation.md)）で入れた。D1 の読み取りは `node:sqlite`。
- 項目ごとの結果・axe・Tab の順・ブラウザの状態・SSE の接続の記録: [summary.json](evidence/epic-0011/summary.json)

## 結果

PASS。AC-1〜AC-5 を全て満たした。コンソールのエラー・警告と失敗した通信は、失敗の経路のために起こした分（オフライン、配信の遮断）を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | A が `/` を開いたまま、B が A の投稿のいいねを押す（6 回、B の押す時刻を 1.5〜4.5 秒の乱数でずらす）。B の押した時刻から A のナビの「通知」の名前が「通知（未読 1 件）」に変わる時刻（MutationObserver で `Date.now()` を記録）を測る。1 回目は通知の画面を開く。失敗の経路として、未ログインで配信を開く | PASS。6 回の測定値は 3,026 / 167 / 1,508 / 2,286 / 2,471 / 745 ms で、全て 5 秒以内（最大 3,026 ms）。1 回目はバッジが 1 つ増え、通知の画面に「B さんがあなたの投稿にいいねしました（新着）」が出て、開くとバッジが消え DB の未読が 0 になった。未ログインの配信は 401 の JSON（`text/event-stream` ではない） | A のバッジ [1280](evidence/epic-0011/ac1-a-badge-1280.png)、[768](evidence/epic-0011/ac1-a-badge-768.png)、[375](evidence/epic-0011/ac1-a-badge-375.png)。前 [1280](evidence/epic-0011/ac1-a-before-1280.png)、[768](evidence/epic-0011/ac1-a-before-768.png)、[375](evidence/epic-0011/ac1-a-before-375.png)。B が押した後 [1280](evidence/epic-0011/ac1-b-liked-1280.png)、[768](evidence/epic-0011/ac1-b-liked-768.png)、[375](evidence/epic-0011/ac1-b-liked-375.png)。一覧 [1280](evidence/epic-0011/ac1-a-list-1280.png)、[768](evidence/epic-0011/ac1-a-list-768.png)、[375](evidence/epic-0011/ac1-a-list-375.png) |
| AC-2 | B が A の投稿に 130 字のコメントを付け、A をフォローする。B は自分の投稿にいいねとコメントをする（失敗の経路）。A が通知の一覧を開き、コメントの行・フォローの行を押す | PASS。一覧は新しい順で、1 番目がフォロー、2 番目がコメント。コメントは本文の先頭 100 字と「…」。コメントの行は `/p/<投稿>`、フォローの行は `/e11_b` へ移る。B が自分の投稿に反応した後も B 宛ての通知は 0 行 | 一覧 [1280](evidence/epic-0011/ac2-a-list-1280.png)、[768](evidence/epic-0011/ac2-a-list-768.png)、[375](evidence/epic-0011/ac2-a-list-375.png)。B の操作 [コメント 1280](evidence/epic-0011/ac2-b-commented-1280.png)、[フォロー 1280](evidence/epic-0011/ac2-b-followed-1280.png)、[自分の投稿 1280](evidence/epic-0011/ac2-b-own-post-1280.png)。移った先 [投稿 1280](evidence/epic-0011/ac2-a-post-opened-1280.png)、[プロフィール 1280](evidence/epic-0011/ac2-a-profile-opened-1280.png)（768・375 も同じ名前で `evidence/epic-0011/` にある） |
| AC-3 | (a) DevTools の Offline（CDP の `Network.emulateNetworkConditions`）で A を切り、B がいいね。(b) Offline とタブを隠す（`visibilitychange`）で A の配信を切り、B が 2 件いいね。7 秒置いて戻し、バッジが直るまでを測る。(c) 配信の経路 `/api/notifications/stream` を abort で塞ぎ、B がいいね（3 回）。(d) 配信の接続を 135 秒見て 60 秒で閉じるかを見る | PASS。(a) Offline だけでは、すでに開いている配信の接続が生き続け、切断中にバッジが 1 に増えた（Chrome の Offline は新しい要求だけを止める。E2E の注記と同じ）。戻した後も DB と同じ 1。(b) 切っている間は A のバッジは 0 のまま（DB は 2）。戻して 10 ms でバッジが 2 になり、4 秒後も 2 のまま（取りこぼしも二重もない）。(c) 配信を塞いでも 6,430 / 5,420 / 6,646 ms（10 秒以内）でバッジが増えた。(d) 接続は 60,013 / 60,016 ms で閉じ、続けて新しい接続が開いた | [Offline のみ](evidence/epic-0011/ac3-a-devtools-offline-1280.png)（[768](evidence/epic-0011/ac3-a-devtools-offline-768.png)、[375](evidence/epic-0011/ac3-a-devtools-offline-375.png)）、[Offline と隠す](evidence/epic-0011/ac3-a-offline-hidden-1280.png)（[768](evidence/epic-0011/ac3-a-offline-hidden-768.png)、[375](evidence/epic-0011/ac3-a-offline-hidden-375.png)）、[復帰後](evidence/epic-0011/ac3-a-recovered-1280.png)（[768](evidence/epic-0011/ac3-a-recovered-768.png)、[375](evidence/epic-0011/ac3-a-recovered-375.png)）、[配信を塞いだ](evidence/epic-0011/ac3-a-sse-blocked-badge-1280.png)（[768](evidence/epic-0011/ac3-a-sse-blocked-badge-768.png)、[375](evidence/epic-0011/ac3-a-sse-blocked-badge-375.png)） |
| AC-4 | 3 人の送り手の like の通知を A 宛てに入れる（91 日前、1 日前、89 日前。ハーネスの `seedNotification`）。一覧を開いてから `pnpm jobs:run notification-cleanup`。失敗の経路として、もう一度の実行と存在しない名前 | PASS。ジョブの終了コード 0、`deleted=1`。91 日前の 1 件だけが消え、1 日前と 89 日前は残った（他の通知は 17 → 16 件で、減ったのは 1 件だけ）。一覧からも 91 日前の行が消えた。再実行は終了コード 0 で何も消さず、存在しない名前は終了コード 2 | 前 [1280](evidence/epic-0011/ac4-a-before-job-1280.png)、[768](evidence/epic-0011/ac4-a-before-job-768.png)、[375](evidence/epic-0011/ac4-a-before-job-375.png)。後 [1280](evidence/epic-0011/ac4-a-after-job-1280.png)、[768](evidence/epic-0011/ac4-a-after-job-768.png)、[375](evidence/epic-0011/ac4-a-after-job-375.png)。ログ [ac4-job-run.txt](evidence/epic-0011/ac4-job-run.txt)、[ac4-job-rerun-and-bad-name.txt](evidence/epic-0011/ac4-job-rerun-and-bad-name.txt) |
| AC-5 | A に 16 件の通知がある状態で、B のセッションで `/notifications` と未読数（配信の最初のイベント）を開く。配信の URL に `userId=<A>`・`recipientId=<A>` を付けても見る。A が B の投稿にいいねして B の 1 件だけを確かめる。A の一覧で Tab と Enter。axe（`@axe-core/playwright`、WCAG 2.2 AA のタグ）を A の一覧・B の一覧・空の一覧 × 2 幅（1280・375）。未ログインで `/notifications` | PASS。B の一覧は「まだ通知はありません」でバッジなし、配信の最初のイベントは `{"unreadCount":0}`（A を指す query を付けても同じ）。A が B の投稿にいいねすると B は 1 件（「A さんがあなたの投稿にいいねしました」の 1 行だけ）。A の一覧は Tab でナビ 5 つの後に 16 行の全てへ届き、Enter で行の先へ移る。axe の重大・深刻な違反は 6 画面で 0 件。未ログインは `/accounts/login` へ移る | B の空 [1280](evidence/epic-0011/ac5-b-empty-1280.png)、[768](evidence/epic-0011/ac5-b-empty-768.png)、[375](evidence/epic-0011/ac5-b-empty-375.png)。B の一覧 [1280](evidence/epic-0011/ac5-b-list-1280.png)、[768](evidence/epic-0011/ac5-b-list-768.png)、[375](evidence/epic-0011/ac5-b-list-375.png)。A の一覧 [1280](evidence/epic-0011/ac5-a-list-1280.png)、[768](evidence/epic-0011/ac5-a-list-768.png)、[375](evidence/epic-0011/ac5-a-list-375.png)。空 [1280](evidence/epic-0011/ac5-c-empty-1280.png)、[768](evidence/epic-0011/ac5-c-empty-768.png)、[375](evidence/epic-0011/ac5-c-empty-375.png)。未ログイン [1280](evidence/epic-0011/ac5-anon-redirect-1280.png)、[768](evidence/epic-0011/ac5-anon-redirect-768.png)、[375](evidence/epic-0011/ac5-anon-redirect-375.png) |

### AC-1 の 5 秒の測り方

B の「いいね」ボタンを押す直前の `Date.now()`（試験を動かす Node）と、A のページの MutationObserver が「通知」リンクの `aria-label` の変化を見た `Date.now()` の差。同じ機械の時計。いいねの前に A は 1.5〜4.5 秒の乱数の間 `/` を開いてあり、配信が確立した状態から測っている。

### キーボードで届くか

[summary.json](evidence/epic-0011/summary.json) の `tabOrder.notifications`。ナビ（ホーム・検索・投稿・通知・プロフィール）の後、一覧の 16 行が上から順に Tab で届く（行ごとに 1 つのリンク）。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0011/summary.json) の `health`。出来事があった手順だけが非ゼロ）。配信 `/api/notifications/stream` の要求は開いたままが期待で、ページ移動での中断（`ERR_ABORTED`）は `sse` に分けて記録し、失敗には数えていない。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ 2 人、フィード、投稿詳細、通知の一覧（A・B・空）、プロフィール、コメント・フォロー、ジョブの前後、キーボード、axe、135 秒の観察 | 0 | 0 |
| AC-1 の失敗の経路（未ログインの配信） | 0（ページを使わず request API で呼んだ） | 401 応答 1 件（想定の応答） |
| AC-3 の Offline（(a)(b)） | 画像（`w640.webp`）の `net::ERR_INTERNET_DISCONNECTED` 各 1 件（起こした切断） | 同じ画像の GET 各 1 件 |
| AC-3 の配信を塞いだ手順（(c)） | 配信の `net::ERR_FAILED` 15 件（abort で塞いだ分。画面は再接続を繰り返した） | 0 |

配信の接続は、開いたまま 60,013〜60,045 ms で閉じ、続けて新しい接続が開いた（A・B・C の 3 画面とも 135 秒に 2 回）。

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして）。typecheck・lint・format・docs・unit 567・integration 361（4 件は想定の skip）・build・e2e 207・perf-budget が全て OK | 0 |

1 回目は終了コード 1 だった。原因は製品ではなく試験の環境で、スロットの初期化（`slot.mjs reset 1`）が、バケットに残っていた 84,293 個のオブジェクト（由来は未調査）の削除に 10 分近くかかり、途中で中断したため `.wrangler/state` が空のまま（migration 未適用）で verify が走り、e2e の 196 件が `no such table: rate_limits` で落ちた（unit 567・integration 361・build は OK）。初期化を最後まで流してやり直したのが上の終了コード 0 の回。子 PBI の E2E（`e2e/notifications.spec.ts`、`e2e/notifications-realtime.spec.ts`、ジョブの `src/jobs` の試験）は verify の e2e・unit・integration に含まれ全て通った。

## 見つけた問題

なし。観察として次の 2 点を残す（どちらも AC の不合格ではない）。

- DevTools の Offline は、すでに開いている SSE の接続を切らない（切断中もバッジが増えた）。AC-3 の「切れている間」は、タブを隠して接続を閉じる手順（(b)）で確かめた。ADR-0050 の「別のタブで既読にした数は次の接続で直る」と同じ系統の、Chrome の仕様による。
- 配信を塞いだ間、再接続の失敗がコンソールに 1 回ずつ `ERR_FAILED` として出る。塞いだことによる想定の出力で、塞がない通常の画面では 0 件。
