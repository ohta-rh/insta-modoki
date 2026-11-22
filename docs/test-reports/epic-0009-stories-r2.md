---
type: TestReport
title: EPIC #9 ストーリーの総合試験（2 回目）
description: 統合ブランチ m3/phase2 の 80aa192 で、EPIC #9 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめ直した。#84 の修正で、ビューアを閉じた直後のトレイが再読み込みなしで更新されるようになり、AC-2 を含む全て PASS。
tags: [epic-test]
---

# EPIC #9 ストーリーの総合試験（2 回目）

## 対象

- EPIC: [#9](https://github.com/ohta-rh/insta-modoki/issues/9)。1 回目 [epic-0009-stories.md](epic-0009-stories.md) は AC-2 で FAIL（閉じたあとのトレイが古いまま）。その修正 #84（ビューアが外れたあとの `router.refresh()`）を含む。
- 試験した commit: `80aa192`（統合ブランチ `m3/phase2`、[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 3（`http://localhost:3103`。`pnpm build` → `PORT=3103 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、空のスロット）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` の使い捨てプロファイルの Google Chrome を CDP で操作した。幅は 1280（高さ 900）・768（1024）・375（812）。
- データ: A・B・C・H のサインアップと A・C のストーリー投稿は UI。D・E・F・G・U1・U2 と、閉じ方の繰り返し用の 9 人（`e9_xesc1..3`、`e9_xbutton1..3`、`e9_xdirect1..3`）は E2E ハーネスで入れた。パスワードは実行時に生成。
- 1 回目の手順に、閉じ方の繰り返し（下の AC-2）を足して流した。145 項目が全て通った。項目ごとの結果・axe・Tab の順・ブラウザの状態: [summary.json](evidence/epic-0009-r2/summary.json)。日次のジョブ: [story-cleanup](evidence/epic-0009-r2/job-story-cleanup.txt)、[upload-orphan-sweep](evidence/epic-0009-r2/job-upload-orphan-sweep.txt)

## 結果

PASS。5 つの AC が全て満たされた。1 回目に落ちた AC-2 は、Esc・閉じる・直接開いた `/stories/<A>` の 3 つの閉じ方を各 3 回で、再読み込みなしにトレイが更新された。コンソールのエラー・警告と失敗した通信は、期限切れの URL の 404（起こした分）と、画面遷移で中断される通知の SSE を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 1 回目と同じ。A が写真（ハイドレーション前に選ぶ）と 5 秒の動画を投稿。B がトレイの A を押し、自動進行・次の人・長押し・← / →・タップ・保存したトレイの順の歩き。閉じるとスクロールとフィードが保たれる | PASS。トレイは追加 → A・C・F・G（未視聴）→ D（視聴済み）で E は無い。写真は 5,008 ms、5 秒の動画は 4,412 ms で次へ。7 秒の長押しで動かない。F → G → A → C → D と歩き、最後で `/` に閉じて戻らない（#82）。Esc・閉じるで scrollY 40・読み込んだ 14 件・トレイへの focus が保たれる | [トレイ 1280](evidence/epic-0009-r2/ac1-tray-1280.png)、[768](evidence/epic-0009-r2/ac1-tray-768.png)、[375](evidence/epic-0009-r2/ac1-tray-375.png)、[写真 1280](evidence/epic-0009-r2/ac1-viewer-photo-1280.png)、[768](evidence/epic-0009-r2/ac1-viewer-photo-768.png)、[375](evidence/epic-0009-r2/ac1-viewer-photo-375.png)、[動画 1280](evidence/epic-0009-r2/ac1-viewer-video-1280.png)、[768](evidence/epic-0009-r2/ac1-viewer-video-768.png)、[375](evidence/epic-0009-r2/ac1-viewer-video-375.png)、[次の人 1280](evidence/epic-0009-r2/ac1-viewer-next-person-c-1280.png)、[768](evidence/epic-0009-r2/ac1-viewer-next-person-c-768.png)、[375](evidence/epic-0009-r2/ac1-viewer-next-person-c-375.png)、[閉じてトレイへ 1280](evidence/epic-0009-r2/ac1-close-returns-to-tray-1280.png)、[768](evidence/epic-0009-r2/ac1-close-returns-to-tray-768.png)、[375](evidence/epic-0009-r2/ac1-close-returns-to-tray-375.png)、[最後で閉じる 1280](evidence/epic-0009-r2/ac1-walk-closed-home-1280.png)、[768](evidence/epic-0009-r2/ac1-walk-closed-home-768.png)、[375](evidence/epic-0009-r2/ac1-walk-closed-home-375.png)（ほかの写真は同じディレクトリの `ac1-*`） |
| AC-2 | (a) B が A の 2 件を見て（自動進行で C へ）Esc で閉じる。再読み込みなしのトレイ。(b) 繰り返し: 未読の U1・U2 を残し、閉じ方ごとに新しい未読の 1 人 X を 3 回ずつ見て閉じる（Esc、閉じる、直接開いた `/stories/X`（Esc・閉じる・Esc））。毎回、再読み込みなしのトレイを調べる。(c) A が閲覧者の一覧を開く。B には閲覧者のボタンが無い。同じ Server Action を B と未ログインで再送 | PASS。(a) 閉じた直後のトレイは 追加・F・G（未視聴）・A・C・D（視聴済み）で、再読み込み後と同じ。A のリングは灰色（背景なし）、未視聴は円錐グラデーション。(b) 9 回全てで、X が 視聴済み になり、未視聴の U2・U1 の後ろ（直後）に入り、未視聴が全て視聴済みより前。リングの描画も違う。Esc・閉じるの 6 回は、閉じたあとも scrollY 40・読み込んだ 14 件が保たれ、focus は X の項目。直接開いた 3 回は `/` に閉じ、ダイアログは残らない。`story_views` は毎回 1 行。(c) 一覧に B が出る（1 人）。B にはボタンが無く、同じ操作は B で `FORBIDDEN`、訪問者で `UNAUTHENTICATED` | 閉じた直後（Esc）[1280](evidence/epic-0009-r2/ac2-tray-after-close-soft-1280.png)、[768](evidence/epic-0009-r2/ac2-tray-after-close-soft-768.png)、[375](evidence/epic-0009-r2/ac2-tray-after-close-soft-375.png)、再読み込み後 [1280](evidence/epic-0009-r2/ac2-tray-after-read-1280.png)、[768](evidence/epic-0009-r2/ac2-tray-after-read-768.png)、[375](evidence/epic-0009-r2/ac2-tray-after-read-375.png)、Esc の 1 回目 [1280](evidence/epic-0009-r2/ac2-close-esc-1-1280.png)、[768](evidence/epic-0009-r2/ac2-close-esc-1-768.png)、[375](evidence/epic-0009-r2/ac2-close-esc-1-375.png)、閉じるの 1 回目 [1280](evidence/epic-0009-r2/ac2-close-button-1-1280.png)、[768](evidence/epic-0009-r2/ac2-close-button-1-768.png)、[375](evidence/epic-0009-r2/ac2-close-button-1-375.png)、直接開いた 1 回目 [1280](evidence/epic-0009-r2/ac2-close-direct-1-1280.png)、[768](evidence/epic-0009-r2/ac2-close-direct-1-768.png)、[375](evidence/epic-0009-r2/ac2-close-direct-1-375.png)（2・3 回目は `ac2-close-<esc｜button｜direct>-<2｜3>-<幅>.png`）、閲覧者の一覧 [1280](evidence/epic-0009-r2/ac2-viewers-list-author-1280.png)、[768](evidence/epic-0009-r2/ac2-viewers-list-author-768.png)、[375](evidence/epic-0009-r2/ac2-viewers-list-author-375.png)、B にボタンが無い [1280](evidence/epic-0009-r2/ac2-viewer-no-button-b-1280.png)、[768](evidence/epic-0009-r2/ac2-viewer-no-button-b-768.png)、[375](evidence/epic-0009-r2/ac2-viewer-no-button-b-375.png)、全員を見たあと [1280](evidence/epic-0009-r2/ac2-tray-all-seen-1280.png) |
| AC-3 | DB に直接 25 時間前の E（4 ファイル）。ホーム、`/stories/e9_e` の直接、ホーム上の `router.push`。`jobs:run story-cleanup`、`upload-orphan-sweep` | PASS。E はトレイに無く、URL は 404「ページが見つかりません」、モーダルも同じ文言。`story-cleanup` は終了 0 で E の行と 4 ファイルが消え、生きている行とファイルは残った。`upload-orphan-sweep` は終了 0 で参照されるファイルと猶予内の孤児を残した。ジョブのあとホーム 200、URL 404 | [404 1280](evidence/epic-0009-r2/ac3-expired-viewer-404-1280.png)、[768](evidence/epic-0009-r2/ac3-expired-viewer-404-768.png)、[375](evidence/epic-0009-r2/ac3-expired-viewer-404-375.png)、[モーダル 1280](evidence/epic-0009-r2/ac3-expired-modal-1280.png)、[768](evidence/epic-0009-r2/ac3-expired-modal-768.png)、[375](evidence/epic-0009-r2/ac3-expired-modal-375.png)、[トレイに出ない 1280](evidence/epic-0009-r2/ac3-home-without-expired-1280.png)、[768](evidence/epic-0009-r2/ac3-home-without-expired-768.png)、[375](evidence/epic-0009-r2/ac3-home-without-expired-375.png) |
| AC-4 | 16 秒の動画（通常と、JS 前・低速回線）、GIF、15 秒ちょうど | PASS。16 秒は選んだ時点で「動画は 15 秒までです」、「投稿」は無効、POST などの通信 0 件、行 0。JS 前に選んだ 16 秒も同じ。GIF は形式の説明。15 秒は `0:15` で投稿でき `duration_ms=15000` | [16 秒 1280](evidence/epic-0009-r2/ac4-16s-refused-1280.png)、[768](evidence/epic-0009-r2/ac4-16s-refused-768.png)、[375](evidence/epic-0009-r2/ac4-16s-refused-375.png)、[GIF 1280](evidence/epic-0009-r2/ac4-gif-refused-1280.png)、[768](evidence/epic-0009-r2/ac4-gif-refused-768.png)、[375](evidence/epic-0009-r2/ac4-gif-refused-375.png)、[15 秒 1280](evidence/epic-0009-r2/ac4-15s-accepted-1280.png)、[768](evidence/epic-0009-r2/ac4-15s-accepted-768.png)、[375](evidence/epic-0009-r2/ac4-15s-accepted-375.png)、[JS 前の 16 秒 1280](evidence/epic-0009-r2/ac4-prehydration-16s-after-1280.png)、[768](evidence/epic-0009-r2/ac4-prehydration-16s-after-768.png)、[375](evidence/epic-0009-r2/ac4-prehydration-16s-after-375.png) |
| AC-5 | 視差効果を減らす設定の H が、キーボードだけで投稿からビューアまで。7 秒待つ。← / →・Esc。axe | PASS。ピッカーまで 7 回の Tab、Space で投稿。リングは hover で動かず、ビューアは Tab が内側を巡り、7 秒後も 1 / 2 のまま（動画も）。→ ← で動き、最後の → でホーム、Esc で閉じてトレイに focus が戻る。axe は作成画面・トレイ・ビューア（モーダルと全画面）・閲覧者の一覧で重大・深刻 0 件 | [投稿に focus 1280](evidence/epic-0009-r2/ac5-create-submit-focus-1280.png)、[768](evidence/epic-0009-r2/ac5-create-submit-focus-768.png)、[375](evidence/epic-0009-r2/ac5-create-submit-focus-375.png)、[ホーム 1280](evidence/epic-0009-r2/ac5-home-tray-1280.png)、[768](evidence/epic-0009-r2/ac5-home-tray-768.png)、[375](evidence/epic-0009-r2/ac5-home-tray-375.png)、[ビューア 1280](evidence/epic-0009-r2/ac5-viewer-modal-reduced-1280.png)、[768](evidence/epic-0009-r2/ac5-viewer-modal-reduced-768.png)、[375](evidence/epic-0009-r2/ac5-viewer-modal-reduced-375.png) |

キーボード: 作成画面は 7 回の Tab でピッカー、ホームからトレイへは 3 回、ビューアの中は 前へ → 次へ → 一時停止 → 閉じる の循環（[summary.json](evidence/epic-0009-r2/summary.json) の `tabOrder`）。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（`summary.json` の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| 作成、ホーム、トレイ、ビューア（モーダル・全画面）、閲覧者の一覧、閉じ方の繰り返し、キーボードと視差効果、axe | 0 | 0（下の SSE を除く） |
| AC-3 の失敗の経路（`/stories/e9_e`） | `Failed to load resource: 404` 2 件（起こした分） | 404 応答 2 件 |
| 全ての画面 | 0 | `GET /api/notifications/stream` の `net::ERR_ABORTED` が遷移のたびに出る（通知の SSE を遷移で中断した分。アプリの失敗ではない） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（スロットを空にして）。typecheck・lint・format・docs・unit 590・integration 370（4 件は想定の skip）・build・e2e 213 件・perf-budget（初期 JS 167,697 バイト、上限 170,000）が全て OK。記録: [verify.txt](evidence/epic-0009-r2/verify.txt)。子 PBI の E2E（`story-create`・`story-tray`・`story-viewer`・`story-cleanup`）は e2e に含まれる | 0 |

## 見つけた問題

なし。1 回目の問題（AC-2: 閉じたあとのトレイが古いまま）は #84 で直り、Esc・閉じる・直接開いた URL の 3 つの閉じ方を各 3 回で再現しなかった。
