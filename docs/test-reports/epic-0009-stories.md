---
type: TestReport
title: EPIC #9 ストーリーの総合試験（1 回目）
description: 統合ブランチ m3/phase2 の c81288b で、EPIC #9 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。AC-1・3・4・5 は満たしたが、AC-2 は、ビューアを閉じて戻ったホームのトレイが古いまま（既読のリングが灰色にならず、順番も変わらない）で FAIL。
tags: [epic-test]
---

# EPIC #9 ストーリーの総合試験（1 回目）

## 対象

- EPIC: [#9](https://github.com/ohta-rh/insta-modoki/issues/9)（子 PBI #47・#54・#55・#56・#77・#79・#81・#82）
- 試験した commit: `c81288b`（統合ブランチ `m3/phase2`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s3`、`slot reset 3` で空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。ビューアの写真は 5 秒で進むため、撮影の間は長押し（pointerdown）で止めた。
- データ: 利用者 A（投稿者）・B（閲覧者）・C・H のサインアップと、A の写真・5 秒の動画、C の 15 秒の動画の投稿は UI で行った（A の写真は、スクリプトの読み込みを止め、300ms の遅延・300KB/s に絞った回線で、ハイドレーションの前にキーボードで選んだ。#81）。D（既読）・E（25 時間前の期限切れ）・F（未読、投稿 14 件）・G（2 件）の利用者・ストーリー・フォローは、アプリ自身の E2E ハーネス `/e2e-harness/db` で入れ、ファイルは署名つきの PUT で置いた（ADR-0041）。パスワードは実行時に生成し、どこにも書いていない。
- 試験は 3 回流した。1 回目と 2 回目は、試験の手順の誤り（トレイの文字列の読み方、「次の人」は保存したトレイの順で既読の人も通ること、終了の判定の 0ms）で数件が落ち、スロットを空にして最初からやり直した。ここに載せるのは 3 回目の結果で、99 項目のうち 98 が通り、1 が落ちた（AC-2。1 回目から 3 回とも同じ）。
- 項目ごとの結果・axe・Tab の順・ブラウザの状態: [summary.json](evidence/epic-0009/summary.json)。日次のジョブの出力: [story-cleanup](evidence/epic-0009/job-story-cleanup.txt)、[upload-orphan-sweep](evidence/epic-0009/job-upload-orphan-sweep.txt)

## 結果

FAIL。AC-1・AC-3・AC-4・AC-5 は満たした。AC-2 は、「ホームに戻る」を、ビューアを閉じて戻る操作で行うと、トレイのリングと並びが古いままで満たさない（下の「見つけた問題」）。コンソールのエラー・警告と失敗した通信は、期限切れの URL の 404（起こした分）と、画面遷移で中断される通知の SSE 接続を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | A が写真（ハイドレーション前にキーボードで選ぶ）と 5 秒の動画を投稿。B がホームを開き、トレイの A を押す。写真の自動進行、動画の再生と自動進行、次の人へ。長押し、← / →、左右のタップ。F から保存したトレイの順に右タップで最後まで歩く。フィードを 14 件読んで scrollY 40 でトレイから開き、Esc・閉じるで戻る | PASS。トレイは「追加」→ A（未視聴）→ C → F → G → D（視聴済み）で、期限切れの E は無い。写真は長押しを離してから 4987ms で次へ、5 秒の動画は 4424ms で次の未読の人 C へ進み、動画は再生される。7 秒の長押しで 1 / 2 のまま。F → G → A → C → D と順に進み、最後の D のあとは `/` に閉じて 2.5 秒たっても戻らない（#82）。履歴は増えない（6 → 6）。D だけを開いて最後まで進んでも同じ。Esc も閉じるも、`/` に戻って scrollY 40・読み込んだ 14 件・トレイの項目への focus が保たれる。JS 前に選んだ写真は、ハイドレーション後にプレビューに入り、投稿できた（スクリプトを 10 件止めた間に選んだ） | JS 前に選んだ写真のプレビュー [1280](evidence/epic-0009/ac1-prehydration-photo-preview-1280.png)、[768](evidence/epic-0009/ac1-prehydration-photo-preview-768.png)、[375](evidence/epic-0009/ac1-prehydration-photo-preview-375.png)、写真の投稿後 [1280](evidence/epic-0009/ac1-photo-posted-home-1280.png)、[768](evidence/epic-0009/ac1-photo-posted-home-768.png)、[375](evidence/epic-0009/ac1-photo-posted-home-375.png)、5 秒の動画の選択 [1280](evidence/epic-0009/ac1-5s-video-preview-1280.png)、[768](evidence/epic-0009/ac1-5s-video-preview-768.png)、[375](evidence/epic-0009/ac1-5s-video-preview-375.png)、トレイ（未視聴のリング） [1280](evidence/epic-0009/ac1-tray-1280.png)、[768](evidence/epic-0009/ac1-tray-768.png)、[375](evidence/epic-0009/ac1-tray-375.png)、ビューア（写真） [1280](evidence/epic-0009/ac1-viewer-photo-1280.png)、[768](evidence/epic-0009/ac1-viewer-photo-768.png)、[375](evidence/epic-0009/ac1-viewer-photo-375.png)、ビューア（動画） [1280](evidence/epic-0009/ac1-viewer-video-1280.png)、[768](evidence/epic-0009/ac1-viewer-video-768.png)、[375](evidence/epic-0009/ac1-viewer-video-375.png)、次の人 C [1280](evidence/epic-0009/ac1-viewer-next-person-c-1280.png)、[768](evidence/epic-0009/ac1-viewer-next-person-c-768.png)、[375](evidence/epic-0009/ac1-viewer-next-person-c-375.png)、長押しで停止 [1280](evidence/epic-0009/ac1-hold-paused-1280.png)、[768](evidence/epic-0009/ac1-hold-paused-768.png)、[375](evidence/epic-0009/ac1-hold-paused-375.png)、順に歩く（G） [1280](evidence/epic-0009/ac1-walk-g-1280.png)、[768](evidence/epic-0009/ac1-walk-g-768.png)、[375](evidence/epic-0009/ac1-walk-g-375.png)、最後で閉じてホーム [1280](evidence/epic-0009/ac1-walk-closed-home-1280.png)、[768](evidence/epic-0009/ac1-walk-closed-home-768.png)、[375](evidence/epic-0009/ac1-walk-closed-home-375.png)、閉じるとトレイの位置へ [1280](evidence/epic-0009/ac1-close-returns-to-tray-1280.png)、[768](evidence/epic-0009/ac1-close-returns-to-tray-768.png)、[375](evidence/epic-0009/ac1-close-returns-to-tray-375.png) |
| AC-2 | B が A の 2 件を全て見る。ビューアを Esc で閉じてホームのトレイを見る。再読み込み。A が自分のストーリーの閲覧者を開く。B には閲覧者のボタンが無い。投稿者が開いたときの閲覧者の一覧の操作（Server Action）を B と未ログインの訪問者の cookie で再送 | **FAIL**。`story_views` には 2 行ができ、再読み込みすると A は灰色（視聴済み）で、順番は未読の F・G の後ろ（F・G → A → C → D）で、リングの描画も未読と違う。しかし、ビューアを Esc で閉じて戻った直後のホームは、A が「未視聴」のまま、並びも A・C・F・G・D のままで古い。閲覧者の一覧は A に B が出て（1 人）、B には「閲覧者」のボタンが無く、同じ操作を B で送ると `FORBIDDEN`（「この操作はできません」）、訪問者は `UNAUTHENTICATED` で、一覧は返らない | 閉じた直後のトレイ（古いまま） [1280](evidence/epic-0009/ac2-tray-after-close-soft-1280.png)、[768](evidence/epic-0009/ac2-tray-after-close-soft-768.png)、[375](evidence/epic-0009/ac2-tray-after-close-soft-375.png)、再読み込み後のトレイ [1280](evidence/epic-0009/ac2-tray-after-read-1280.png)、[768](evidence/epic-0009/ac2-tray-after-read-768.png)、[375](evidence/epic-0009/ac2-tray-after-read-375.png)、全員を見たあと [1280](evidence/epic-0009/ac2-tray-all-seen-1280.png)、[768](evidence/epic-0009/ac2-tray-all-seen-768.png)、[375](evidence/epic-0009/ac2-tray-all-seen-375.png)、投稿者の閲覧者の一覧 [1280](evidence/epic-0009/ac2-viewers-list-author-1280.png)、[768](evidence/epic-0009/ac2-viewers-list-author-768.png)、[375](evidence/epic-0009/ac2-viewers-list-author-375.png)、B にはボタンが無い [1280](evidence/epic-0009/ac2-viewer-no-button-b-1280.png)、[768](evidence/epic-0009/ac2-viewer-no-button-b-768.png)、[375](evidence/epic-0009/ac2-viewer-no-button-b-375.png) |
| AC-3 | DB に直接 25 時間前のストーリー（4 ファイルつき）を持つ E を入れる。B がホームを開き、`/stories/e9_e` を直接開き、ホーム上で `router.push` して開く。`pnpm jobs:run story-cleanup`、`pnpm jobs:run upload-orphan-sweep` | PASS。E はトレイに出ず、URL は HTTP 404 で見出しが「ページが見つかりません」、ホーム上ではモーダルに同じ文言と「閉じる」。`story-cleanup` は終了コード 0（`deleted=1`）で E の行と 4 ファイルが消え、生きているストーリー（A 2・C 1・D 1・F 1・G 2）の行と D のファイルは残った。`upload-orphan-sweep` は終了コード 0（`deleted=0`）で、参照されているファイルと、24 時間の猶予の中にある参照されないファイルは残った（24 時間より古い孤児の削除は、本物の時計を進められないため結合テスト `upload-orphan-sweep.int.test.ts` に任せる）。ジョブのあともホームは 200、URL は 404 のまま | 期限切れの URL は 404 [1280](evidence/epic-0009/ac3-expired-viewer-404-1280.png)、[768](evidence/epic-0009/ac3-expired-viewer-404-768.png)、[375](evidence/epic-0009/ac3-expired-viewer-404-375.png)、ホーム上のモーダル [1280](evidence/epic-0009/ac3-expired-modal-1280.png)、[768](evidence/epic-0009/ac3-expired-modal-768.png)、[375](evidence/epic-0009/ac3-expired-modal-375.png)、トレイに出ない [1280](evidence/epic-0009/ac3-home-without-expired-1280.png)、[768](evidence/epic-0009/ac3-home-without-expired-768.png)、[375](evidence/epic-0009/ac3-home-without-expired-375.png) |
| AC-4 | 16 秒の動画を選ぶ（通常と、JS 前・低速回線）。GIF を選ぶ。15 秒ちょうどの動画を投稿 | PASS。16 秒は選んだ時点で「動画は 15 秒までです」が出て、「投稿」は無効、POST・PUT などの通信は 0 件、行は 0。JS 前に選んだ 16 秒も、ハイドレーション後に同じ理由が出て通信は 0 件。GIF は「この形式は使えません（JPEG・PNG・WebP・HEIC・MP4）」。15 秒の動画は `0:15` と出て投稿でき、行は `type=video`・`duration_ms=15000`・320x568 | 作成画面 [1280](evidence/epic-0009/ac4-create-empty-1280.png)、[768](evidence/epic-0009/ac4-create-empty-768.png)、[375](evidence/epic-0009/ac4-create-empty-375.png)、16 秒を拒む [1280](evidence/epic-0009/ac4-16s-refused-1280.png)、[768](evidence/epic-0009/ac4-16s-refused-768.png)、[375](evidence/epic-0009/ac4-16s-refused-375.png)、GIF を拒む [1280](evidence/epic-0009/ac4-gif-refused-1280.png)、[768](evidence/epic-0009/ac4-gif-refused-768.png)、[375](evidence/epic-0009/ac4-gif-refused-375.png)、JS 前に選んだ 16 秒 [1280](evidence/epic-0009/ac4-prehydration-16s-after-1280.png)、[768](evidence/epic-0009/ac4-prehydration-16s-after-768.png)、[375](evidence/epic-0009/ac4-prehydration-16s-after-375.png)、15 秒ちょうど [1280](evidence/epic-0009/ac4-15s-accepted-1280.png)、[768](evidence/epic-0009/ac4-15s-accepted-768.png)、[375](evidence/epic-0009/ac4-15s-accepted-375.png)、15 秒の投稿後 [1280](evidence/epic-0009/ac4-15s-posted-home-1280.png)、[768](evidence/epic-0009/ac4-15s-posted-home-768.png)、[375](evidence/epic-0009/ac4-15s-posted-home-375.png) |
| AC-5 | 視差効果を減らす設定の利用者 H が、キーボードだけで /stories/create から投稿（Tab でピッカー、Enter、Tab で代替テキスト、Tab で 投稿、Space）。ホームのトレイに Tab で届き Enter でビューア。Tab の閉じ込め、7 秒待つ。← / →、Esc。axe（WCAG 2.2 AA のタグ）を作成画面（2 状態）・トレイのホーム・ビューア（モーダルと全画面）・閲覧者の一覧の 6 画面 × 2 幅 | PASS。ピッカーまで 7 回の Tab、投稿は Space で成功。トレイのリングは hover で動かない（`transform: none`・`transition-duration: 0s`）。ビューアは「閉じる」に focus が入り、Tab は前へ・次へ・一時停止・閉じるを巡って外へ出ない。7 秒待っても 1 / 2 のまま（動画の話も同じ）。→ で 2 / 2、← で 1 / 2、最後の → でホームへ、Esc で閉じてトレイの項目に focus が戻る。axe は 6 画面 × 2 幅で重大・深刻 0 件（全ての違反でも 0 件） | キーボードで 投稿 に focus [1280](evidence/epic-0009/ac5-create-submit-focus-1280.png)、[768](evidence/epic-0009/ac5-create-submit-focus-768.png)、[375](evidence/epic-0009/ac5-create-submit-focus-375.png)、視差効果を減らすホーム [1280](evidence/epic-0009/ac5-home-tray-1280.png)、[768](evidence/epic-0009/ac5-home-tray-768.png)、[375](evidence/epic-0009/ac5-home-tray-375.png)、視差効果を減らすビューア [1280](evidence/epic-0009/ac5-viewer-modal-reduced-1280.png)、[768](evidence/epic-0009/ac5-viewer-modal-reduced-768.png)、[375](evidence/epic-0009/ac5-viewer-modal-reduced-375.png)、[ピッカーの focus（1280）](evidence/epic-0009/ac5-create-picker-focus-1280.png)、[トレイの focus（1280）](evidence/epic-0009/ac5-tray-focus-1280.png) |

### キーボードで届くか

[summary.json](evidence/epic-0009/summary.json) の `tabOrder`。作成画面は 7 回の Tab でピッカーに届き、次の Tab が代替テキスト、その次が「投稿」。ホームからトレイの G の項目へは 3 回。ビューアの中は 前へ → 次へ → 一時停止 → 閉じる の循環。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0009/summary.json) の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ、作成画面、ホーム、トレイ、ビューア（モーダル・全画面）、閲覧者の一覧、キーボードと視差効果の操作、axe | 0 | 0（下の SSE を除く） |
| AC-3 の失敗の経路（期限切れの `/stories/e9_e` を直接開く） | `Failed to load resource: 404` 2 件（想定の応答） | 404 応答 2 件 |
| 全ての画面 | 0 | `GET /api/notifications/stream` の `net::ERR_ABORTED` が画面遷移のたびに出る（通知の SSE を遷移で中断した分。アプリの失敗ではない。EPIC #11 の接続と同じ） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして）。unit 589・integration 370（4 件は想定の skip）・build・e2e 207 件・perf-budget（初期 JS 167,617 バイト、上限 170,000）が全て OK。記録: [verify.txt](evidence/epic-0009/verify.txt)。子 PBI の E2E（`story-create`・`story-tray`・`story-viewer`・`story-cleanup`）は verify の e2e に含まれる | 0 |

## 見つけた問題

1. **AC-2: ビューアを閉じて戻ったホームのトレイが古いまま。**
   - 再現: B が A をフォローし、A に 2 件のストーリーがある。B がホームを開き、トレイの A を押して 2 件を見る（自動進行で次の人 C まで進む）。Esc（または「閉じる」）でビューアを閉じる。
   - 期待: A のリングが灰色（視聴済み）になり、A が未読の C・F・G の後ろへ下がる（AC-2）。
   - 実際: 閉じた直後のホームは、A が「未視聴」のまま、並びも A・C・F・G・D で変わらない。再読み込みすると F・G・A・C・D で A は灰色になる。`story_views` の行は正しくできている。写真: [ac2-tray-after-close-soft](evidence/epic-0009/ac2-tray-after-close-soft-1280.png)（閉じた直後）、[ac2-tray-after-read](evidence/epic-0009/ac2-tray-after-read-1280.png)（再読み込み後）。3 回の実行で毎回同じ。
   - 根本原因（仮説、コードと動きから）: モーダルのビューアは閉じるときに `router.back()` を呼ぶ（`src/features/story/ui/StoryViewer.tsx:86`）。戻った先のホームは、開く前にクライアントのルーターが持っていたサーバーコンポーネントの結果を再利用し、視聴の記録（`markStoryViewedAction`）のあとにも `router.refresh()` や再検証が無いので、トレイは取り直されない。`src/features/story` に `refresh`・`revalidate` は 1 件も無い（grep で確認）。
