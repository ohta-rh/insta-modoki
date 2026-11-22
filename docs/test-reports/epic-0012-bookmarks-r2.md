---
type: TestReport
title: EPIC #12 保存の総合試験（2 回目）
description: 統合ブランチ m3/phase2 の 62cc427（アプリのコードは 80aa192 と同一）で、未読バッジ（#86）・ストーリー（#84）・共通の投稿カードが入ったあとの再試験（ADR-0048）。EPIC #12 の 4 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめ、未読の通知があるアカウントでも全て満たした。PASS。
tags: [epic-test]
---

# EPIC #12 保存の総合試験（2 回目）

## 対象

- EPIC: [#12](https://github.com/ohta-rh/insta-modoki/issues/12)（子 PBI #51）。[1 回目](epic-0012-bookmarks.md)（3fa2347、PASS）の再試験（[ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)）。理由: 1 回目のあとに、ナビの未読バッジのマークアップ（#86）、ストーリーのビューア（#84）、共通の投稿カードが入った
- 試験した commit: `62cc427`（統合ブランチ `m3/phase2`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり。アプリのコードは `80aa192` と同一で、その後はレポートだけの commit）
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s1`、空から）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は 1280（高さ 900）・768（1024）・375（812）。
- データ: 利用者 A・B・C のサインアップ、保存・解除、C による削除は UI で行った。C の投稿 15 件・A の投稿 1 件・フォロー・13 件のまとめ保存は E2E ハーネス `/e2e-harness/db` で入れた（ADR-0041）。1 回目との違い: B が A の投稿を UI でいいねし、A に未読の通知（ナビの鈴が「通知（未読 1 件）」）がある状態で全ての試験を流した（A は通知の画面を開かないので、最後まで未読のまま）。
- 試験は 1 回で全項目が通った（48 項目）。記録: [summary.json](evidence/epic-0012-r2/summary.json)、[run.log](evidence/epic-0012-r2/run.log)

## 結果

PASS。AC-1〜AC-4 を全て満たした。コンソールのエラー・警告と失敗した通信は、失敗の経路のために起こした分と、JS を止めた文脈の分を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | A が C をフォローしてフィードを開く。1 番目の投稿の保存ボタンを、応答を止めたまま押す。再読み込み。投稿詳細・フィードの 2 番目でも保存。「保存済み」タブ、タイルのモーダルで解除。失敗の経路: 保存の POST の abort、未ログインの訪問者、JS を止めた文脈、保存 0 件の空の状態、13 件のスクロール | PASS。応答前に `aria-pressed="true"`・塗りつぶしになり、DB は 0 行のまま。応答後に 1 行、再読み込み後も保存。タブは保存した新しい順に 3 件（13 → 10 → 14 番目）、モーダルで押すと 0 行に戻り、タブを開き直すと消える。POST を落とすとボタンは元に戻り、「エラーが発生しました。しばらくしてからもう一度お試しください」が出て 0 行。未ログインで押すと `/accounts/login` へ。JS 無しでも form で保存・解除できる。0 件では「保存した投稿はまだありません」。13 件は最初 12 件、スクロールで 13 件になり重複なし・新しい順 | 空の保存済み [1280](evidence/epic-0012-r2/ac1-saved-empty-1280.png)・[768](evidence/epic-0012-r2/ac1-saved-empty-768.png)・[375](evidence/epic-0012-r2/ac1-saved-empty-375.png)、自分のプロフィール [1280](evidence/epic-0012-r2/ac1-profile-own-posts-tab-1280.png)・[768](evidence/epic-0012-r2/ac1-profile-own-posts-tab-768.png)・[375](evidence/epic-0012-r2/ac1-profile-own-posts-tab-375.png)、フィード（保存前） [1280](evidence/epic-0012-r2/ac1-feed-before-1280.png)・[768](evidence/epic-0012-r2/ac1-feed-before-768.png)・[375](evidence/epic-0012-r2/ac1-feed-before-375.png)、押した瞬間（応答を止めた間） [1280](evidence/epic-0012-r2/ac1-feed-optimistic-1280.png)・[768](evidence/epic-0012-r2/ac1-feed-optimistic-768.png)・[375](evidence/epic-0012-r2/ac1-feed-optimistic-375.png)、再読み込み後 [1280](evidence/epic-0012-r2/ac1-feed-after-reload-1280.png)・[768](evidence/epic-0012-r2/ac1-feed-after-reload-768.png)・[375](evidence/epic-0012-r2/ac1-feed-after-reload-375.png)、投稿詳細で保存 [1280](evidence/epic-0012-r2/ac1-detail-saved-1280.png)・[768](evidence/epic-0012-r2/ac1-detail-saved-768.png)・[375](evidence/epic-0012-r2/ac1-detail-saved-375.png)、保存済みタブ（3 件） [1280](evidence/epic-0012-r2/ac1-saved-tab-1280.png)・[768](evidence/epic-0012-r2/ac1-saved-tab-768.png)・[375](evidence/epic-0012-r2/ac1-saved-tab-375.png)、タイルのモーダル [1280](evidence/epic-0012-r2/ac1-saved-modal-1280.png)・[768](evidence/epic-0012-r2/ac1-saved-modal-768.png)・[375](evidence/epic-0012-r2/ac1-saved-modal-375.png)、モーダルで解除 [1280](evidence/epic-0012-r2/ac1-modal-unsaved-1280.png)・[768](evidence/epic-0012-r2/ac1-modal-unsaved-768.png)・[375](evidence/epic-0012-r2/ac1-modal-unsaved-375.png)、解除後のタブ [1280](evidence/epic-0012-r2/ac1-saved-after-unsave-1280.png)・[768](evidence/epic-0012-r2/ac1-saved-after-unsave-768.png)・[375](evidence/epic-0012-r2/ac1-saved-after-unsave-375.png)、通信失敗で元に戻る [1280](evidence/epic-0012-r2/ac1-failure-rollback-1280.png)・[768](evidence/epic-0012-r2/ac1-failure-rollback-768.png)・[375](evidence/epic-0012-r2/ac1-failure-rollback-375.png)、未ログインはログインへ [1280](evidence/epic-0012-r2/ac1-visitor-login-1280.png)・[768](evidence/epic-0012-r2/ac1-visitor-login-768.png)・[375](evidence/epic-0012-r2/ac1-visitor-login-375.png)、JS 無しで保存 [1280](evidence/epic-0012-r2/ac1-nojs-saved-1280.png)・[768](evidence/epic-0012-r2/ac1-nojs-saved-768.png)・[375](evidence/epic-0012-r2/ac1-nojs-saved-375.png)、全て解除して空 [1280](evidence/epic-0012-r2/ac1-saved-empty-again-1280.png)・[768](evidence/epic-0012-r2/ac1-saved-empty-again-768.png)・[375](evidence/epic-0012-r2/ac1-saved-empty-again-375.png)、13 件（スクロール後） [1280](evidence/epic-0012-r2/ac1-saved-13-1280.png)・[768](evidence/epic-0012-r2/ac1-saved-13-768.png)・[375](evidence/epic-0012-r2/ac1-saved-13-375.png) |
| AC-2 | B が `/e12_a` と `/e12_a?tab=saved` を開く。B 自身の `?tab=saved`。未ログインの訪問者。A の `?tab=foo` | PASS。B には「保存済み」タブが無く、`?tab=saved` は 200 で「投稿」が選ばれ、HTML に A の保存した 13 件の id は 0 件。B 自身の保存済みは空で A の保存は出ない。訪問者も同じ（タブ無し、id 無し）。A の `?tab=foo` は「投稿」 | B が A を開く [1280](evidence/epic-0012-r2/ac2-b-views-a-1280.png)・[768](evidence/epic-0012-r2/ac2-b-views-a-768.png)・[375](evidence/epic-0012-r2/ac2-b-views-a-375.png)、B が ?tab=saved [1280](evidence/epic-0012-r2/ac2-b-saved-param-1280.png)・[768](evidence/epic-0012-r2/ac2-b-saved-param-768.png)・[375](evidence/epic-0012-r2/ac2-b-saved-param-375.png)、B 自身の保存済み [1280](evidence/epic-0012-r2/ac2-b-own-saved-empty-1280.png)・[768](evidence/epic-0012-r2/ac2-b-own-saved-empty-768.png)・[375](evidence/epic-0012-r2/ac2-b-own-saved-empty-375.png)、未ログインの訪問者 [1280](evidence/epic-0012-r2/ac2-visitor-1280.png)・[768](evidence/epic-0012-r2/ac2-visitor-768.png)・[375](evidence/epic-0012-r2/ac2-visitor-375.png)、A が ?tab=foo [1280](evidence/epic-0012-r2/ac2-a-tab-foo-1280.png)・[768](evidence/epic-0012-r2/ac2-a-tab-foo-768.png)・[375](evidence/epic-0012-r2/ac2-a-tab-foo-375.png) |
| AC-3 | A が 13 件保存。C が UI で 1 件を削除。A が保存済みタブを下まで開く。削除された投稿の URL を開く | PASS。削除前は含まれ、削除後は 12 件で当該の投稿は無く、`bookmarks` の行も連鎖して 0。削除された投稿の URL は 404 | C が自分の投稿を開く [1280](evidence/epic-0012-r2/ac3-c-opens-own-post-1280.png)・[768](evidence/epic-0012-r2/ac3-c-opens-own-post-768.png)・[375](evidence/epic-0012-r2/ac3-c-opens-own-post-375.png)、削除の確認 [1280](evidence/epic-0012-r2/ac3-c-delete-dialog-1280.png)・[768](evidence/epic-0012-r2/ac3-c-delete-dialog-768.png)・[375](evidence/epic-0012-r2/ac3-c-delete-dialog-375.png)、削除後の A の保存済み [1280](evidence/epic-0012-r2/ac3-saved-after-delete-1280.png)・[768](evidence/epic-0012-r2/ac3-saved-after-delete-768.png)・[375](evidence/epic-0012-r2/ac3-saved-after-delete-375.png)、削除された投稿の URL [1280](evidence/epic-0012-r2/ac3-deleted-404-1280.png)・[768](evidence/epic-0012-r2/ac3-deleted-404-768.png)・[375](evidence/epic-0012-r2/ac3-deleted-404-375.png) |
| AC-4 | キーボードだけで保存ボタンとプロフィールのタブを操作。axe（`@axe-core/playwright`、WCAG 2.2 AA のタグ）をフィード・投稿詳細・保存済みタブ・プロフィールの 4 画面 × 2 幅（1280・375）。A に未読の通知がある状態 | PASS。保存ボタンは Tab で届き（名前「保存」、44×44px 以上）、Enter で保存（「保存しました」）、Space で解除（「保存を取り消しました」）。タブは `role="tablist"`/`tab`、選ばれたものが `tabindex="0"`、他方は `-1`。→ で「保存済み」、← で「投稿」にフォーカスが移り、Enter で開く。axe は 4 画面 × 2 幅で重大・深刻 0 件（全ての違反でも 0 件）。未読バッジがあっても Tab の順は崩れない | 保存ボタンに focus [1280](evidence/epic-0012-r2/ac4-save-focused-1280.png)・[768](evidence/epic-0012-r2/ac4-save-focused-768.png)・[375](evidence/epic-0012-r2/ac4-save-focused-375.png)、Enter で保存 [1280](evidence/epic-0012-r2/ac4-enter-saved-1280.png)・[768](evidence/epic-0012-r2/ac4-enter-saved-768.png)・[375](evidence/epic-0012-r2/ac4-enter-saved-375.png)、Space で解除 [1280](evidence/epic-0012-r2/ac4-space-unsaved-1280.png)・[768](evidence/epic-0012-r2/ac4-space-unsaved-768.png)・[375](evidence/epic-0012-r2/ac4-space-unsaved-375.png)、→ で保存済みタブへ [1280](evidence/epic-0012-r2/ac4-tab-arrow-right-1280.png)・[768](evidence/epic-0012-r2/ac4-tab-arrow-right-768.png)・[375](evidence/epic-0012-r2/ac4-tab-arrow-right-375.png)、← で投稿タブへ [1280](evidence/epic-0012-r2/ac4-tab-arrow-left-1280.png)・[768](evidence/epic-0012-r2/ac4-tab-arrow-left-768.png)・[375](evidence/epic-0012-r2/ac4-tab-arrow-left-375.png) |

### キーボードで届くか

[summary.json](evidence/epic-0012-r2/summary.json) の `tabOrder.postDetail`（1280px）。本文へ移動 → ナビ 5 つ（鈴は「通知（未読 1 件）」）→ 投稿者 → いいね → いいねした人 → コメント → 保存 → 投稿者、の順で、保存ボタンに Tab だけで届く。プロフィールのタブは選ばれた 1 つだけが Tab の順に入り（roving tabindex）、残りは矢印で移る。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0012-r2/summary.json) の `health`）。通知の SSE（`/api/notifications/stream`）が画面の移動で中断される `net::ERR_ABORTED` は想定のため `sse` に分けて数えた。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ 3 人、フィード、投稿詳細、保存済みタブ（空・3 件・13 件）、モーダル、B・訪問者の閲覧、`?tab=foo`、C の削除、キーボードの操作と axe | 0 | 0 |
| AC-1 の失敗の経路（保存の POST を `abort`） | `Failed to load resource: net::ERR_FAILED` 1 件（起こした失敗） | POST 1 件（`abort`） |
| AC-1 の JS を止めた文脈 | 0 | 同梱の script の GET 5 件が `csp`（JS を止めたことによる Chrome の遮断。アプリの不具合ではない） |
| AC-3 の失敗の経路（削除された投稿の URL） | `Failed to load resource: 404` 1 件（想定の応答） | 404 応答 1 件 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして）。typecheck・lint・format・docs OK、unit 590、integration 370（4 件は想定の skip）、build、e2e 213 件（子 PBI #51 の `e2e/bookmark.spec.ts` を含む）、perf-budget（初期 JS 167,683 / 170,000 byte）が全て OK。記録: [verify.txt](evidence/epic-0012-r2/verify.txt) | 0 |

## 見つけた問題

なし。
