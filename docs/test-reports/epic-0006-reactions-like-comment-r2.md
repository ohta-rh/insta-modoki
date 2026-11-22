---
type: TestReport
title: EPIC #6 リアクション（いいね・コメント）の総合試験（2 回目）
description: リファクタ 52a1ddb..836c2e6 の後の 3e3fd55 で、EPIC #6 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）でやり直した（ADR-0048）。いいねした人 45 人・コメント 45 件のページ送り、2 つのダイアログのフォーカス、JS 無しのフォーム、失敗の文も確かめ、全て満たした。コンソールの警告・エラーと失敗した通信は、わざと起こした分を除いて 0。結果は PASS。
tags: [epic-test]
---

# EPIC #6 リアクションの総合試験（2 回目）

## 対象

- EPIC: [#6](https://github.com/ohta-rh/insta-modoki/issues/6)（子 PBI #34 いいね・#35 コメント）
- やり直す理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。1 回目（[レポート](epic-0006-reactions-like-comment.md)）の後にリファクタ 52a1ddb..836c2e6（いいね・コメントの Server Action の共通の失敗の包み `src/shared/action.ts` と JS 無しのフォームの結果 `formFailure`、コメントと「いいねした人」のキーセットのページ送り `src/shared/db/cursor.ts`、一覧のアバターの URL、`isPostId` を post の slice から取る変更、セッションの `cache`、「いいねした人」と削除の確認のフォーカスの輪 `trapTab`、失敗のメッセージ `INTERNAL_MESSAGE`）が入った。
- 試験した commit: `3e3fd55`（ブランチ `epic-test/6`。統合ブランチ `m1/local-mvp` の先頭、[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)）
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`、バケット `insta-s1`、空のスロットから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データは全て UI から作った。利用者は A（投稿者）・B（アバターあり）・C と、いいね用の 44 人（実際のサインアップ）。パスワードは実行時に生成し、どこにも書いていない。写真は `sharp` で作った 1000x1000 の JPEG。1 回目の実行は試験用の手順の誤り（利用者名の大文字小文字、2 つの確認の文字列）で 2 項目が落ちたため、手順を直してやり直した。ここに載せるのはやり直しの結果（製品の不具合ではない）。
- 項目ごとのデータと axe・ブラウザの状態: [summary.json](evidence/epic-0006-r2/summary.json)、実行の記録: [run-log.txt](evidence/epic-0006-r2/run-log.txt)

## 結果

PASS。AC-1〜AC-7 を全て満たした。リファクタの影響を見た点（45 人・45 件のページ送りの並びと重複・抜け、2 つのダイアログのフォーカス、JS 無しのフォーム、失敗の文）はどれも壊れていない。コンソールのエラー・警告と失敗した通信は、わざと起こした失敗を除いて 0（「警告」は 0 件）。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 利用者 B で A の投稿 P1 の写真をダブルタップ、再読み込み、もう一度ダブルタップして再読み込み。失敗の経路: ログアウトのままダブルタップ | PASS。直後に `aria-pressed=true`・`fill=currentColor`・「1 件のいいね」。再読み込みしても残り、2 回目でも取り消されない。ログアウト中は `/accounts/login` に移りハート 0 個 | 直後 [1280](evidence/epic-0006-r2/ac1-after-doubletap-1280.png)、[768](evidence/epic-0006-r2/ac1-after-doubletap-768.png)、[375](evidence/epic-0006-r2/ac1-after-doubletap-375.png)、再読み込み後 [1280](evidence/epic-0006-r2/ac1-after-reload-1280.png)、[768](evidence/epic-0006-r2/ac1-after-reload-768.png)、[375](evidence/epic-0006-r2/ac1-after-reload-375.png)、2 回目 [1280](evidence/epic-0006-r2/ac1-second-doubletap-1280.png)、[768](evidence/epic-0006-r2/ac1-second-doubletap-768.png)、[375](evidence/epic-0006-r2/ac1-second-doubletap-375.png)、ログアウト中 [1280](evidence/epic-0006-r2/ac1-signed-out-1280.png)、[768](evidence/epic-0006-r2/ac1-signed-out-768.png)、[375](evidence/epic-0006-r2/ac1-signed-out-375.png) |
| AC-2 | ハートで取り消し。B を含む 45 人が実際にサインアップして P2 にいいね。件数から一覧を開き、Tab・Shift+Tab、一番下までスクロール、Esc。0 件の P1 で一覧を開く | PASS。取り消しで `fill=none`・0 件、再読み込みしても 0。一覧は 20 人 → スクロールで 45 人（3 ページ。重複なし、抜けなし）。順番は DB の `created_at` 降順・`user_id` 降順と一致し、いいねした順の逆。アバターありの B の行の画像は読み込まれる。Tab 30 回・Shift+Tab 30 回でフォーカスはダイアログの外へ出ない。Esc で閉じ、フォーカスは「45 件のいいね」に戻る。0 件では「まだいいねはありません」 | 取り消し [1280](evidence/epic-0006-r2/ac2-unliked-1280.png)、[768](evidence/epic-0006-r2/ac2-unliked-768.png)、[375](evidence/epic-0006-r2/ac2-unliked-375.png)、一覧 20 人 [1280](evidence/epic-0006-r2/ac2-likers-20-1280.png)、[768](evidence/epic-0006-r2/ac2-likers-20-768.png)、[375](evidence/epic-0006-r2/ac2-likers-20-375.png)、スクロール途中 [1280](evidence/epic-0006-r2/ac2-likers-more-1280.png)、[768](evidence/epic-0006-r2/ac2-likers-more-768.png)、[375](evidence/epic-0006-r2/ac2-likers-more-375.png)、全員 [1280](evidence/epic-0006-r2/ac2-likers-all-1280.png)、[768](evidence/epic-0006-r2/ac2-likers-all-768.png)、[375](evidence/epic-0006-r2/ac2-likers-all-375.png)、Esc 後 [1280](evidence/epic-0006-r2/ac2-after-esc-1280.png)、[768](evidence/epic-0006-r2/ac2-after-esc-768.png)、[375](evidence/epic-0006-r2/ac2-after-esc-375.png)、空の一覧 [1280](evidence/epic-0006-r2/ac2-likers-empty-1280.png)、[768](evidence/epic-0006-r2/ac2-likers-empty-768.png)、[375](evidence/epic-0006-r2/ac2-likers-empty-375.png) |
| AC-3 | `page.route` で P1 の POST を `abort`、状態 500 の応答にして押す。戻して押す | PASS。押した直後は `aria-pressed=true`、失敗で `false`・0 件に戻り、「エラーが発生しました。しばらくしてからもう一度お試しください」が `role="alert"` で出る（`abort`・500 とも同じ文）。通信を戻すといいねでき、再読み込みしても残る | 巻き戻し [1280](evidence/epic-0006-r2/ac3-rolled-back-1280.png)、[768](evidence/epic-0006-r2/ac3-rolled-back-768.png)、[375](evidence/epic-0006-r2/ac3-rolled-back-375.png) |
| AC-4 | B が P3 にコメントし、返信し、再読み込み。空の入力と 2,201 字 | PASS。コメントが末尾にすぐ出て、返信は親より 44px 字下げ、再読み込みしても同じ。空の入力は「投稿」が無効で「まだコメントはありません」。2,201 字はカウンタ `2201 / 2,200` と「コメントは 2,200 字までです」で、増えない | 空の状態 [1280](evidence/epic-0006-r2/ac4-empty-1280.png)、[768](evidence/epic-0006-r2/ac4-empty-768.png)、[375](evidence/epic-0006-r2/ac4-empty-375.png)、コメントと返信 [1280](evidence/epic-0006-r2/ac4-comment-and-reply-1280.png)、[768](evidence/epic-0006-r2/ac4-comment-and-reply-768.png)、[375](evidence/epic-0006-r2/ac4-comment-and-reply-375.png)、再読み込み後 [1280](evidence/epic-0006-r2/ac4-after-reload-1280.png)、[768](evidence/epic-0006-r2/ac4-after-reload-768.png)、[375](evidence/epic-0006-r2/ac4-after-reload-375.png)、2,201 字 [1280](evidence/epic-0006-r2/ac4-too-long-1280.png)、[768](evidence/epic-0006-r2/ac4-too-long-768.png)、[375](evidence/epic-0006-r2/ac4-too-long-375.png) |
| AC-5 | B で A の投稿を見る。B が自分の返信を削除（キャンセル、確認で Tab・Shift+Tab、通信失敗、Esc、削除）。投稿者 A が C のコメントを削除。第三者 C で見る | PASS。B には他人のコメントの「削除」が 0 個。確認では Tab 10 回・Shift+Tab 10 回で「削除」と「キャンセル」の間を巡りダイアログの外へ出ない。通信を失敗させて「削除」を押すと確認の中に「エラーが発生しました。しばらくしてからもう一度お試しください」が出てコメントは残る。Esc で閉じ、フォーカスは開いたボタンに戻る。キャンセルで消えず、確認すると消えて再読み込みしても戻らない。A は全てのコメントを削除でき、C のコメントを消すと戻らない。C には「削除」が出ない。失敗した削除の後の最初の Tab で body に落ちる挙動は、既知の #76 のとおり再現した（失敗の条件にしない） | B の画面 [1280](evidence/epic-0006-r2/ac5-b-view-no-delete-on-others-1280.png)、[768](evidence/epic-0006-r2/ac5-b-view-no-delete-on-others-768.png)、[375](evidence/epic-0006-r2/ac5-b-view-no-delete-on-others-375.png)、自分の確認 [1280](evidence/epic-0006-r2/ac5-confirm-own-1280.png)、[768](evidence/epic-0006-r2/ac5-confirm-own-768.png)、[375](evidence/epic-0006-r2/ac5-confirm-own-375.png)、削除の失敗 [1280](evidence/epic-0006-r2/ac5-delete-failed-1280.png)、[768](evidence/epic-0006-r2/ac5-delete-failed-768.png)、[375](evidence/epic-0006-r2/ac5-delete-failed-375.png)、自分の削除後 [1280](evidence/epic-0006-r2/ac5-after-delete-own-1280.png)、[768](evidence/epic-0006-r2/ac5-after-delete-own-768.png)、[375](evidence/epic-0006-r2/ac5-after-delete-own-375.png)、A の画面 [1280](evidence/epic-0006-r2/ac5-author-view-1280.png)、[768](evidence/epic-0006-r2/ac5-author-view-768.png)、[375](evidence/epic-0006-r2/ac5-author-view-375.png)、他人のコメントの確認 [1280](evidence/epic-0006-r2/ac5-confirm-others-1280.png)、[768](evidence/epic-0006-r2/ac5-confirm-others-768.png)、[375](evidence/epic-0006-r2/ac5-confirm-others-375.png)、他人のコメントの削除後 [1280](evidence/epic-0006-r2/ac5-after-delete-others-1280.png)、[768](evidence/epic-0006-r2/ac5-after-delete-others-768.png)、[375](evidence/epic-0006-r2/ac5-after-delete-others-375.png) |
| AC-6 | C が P4 に親コメント 45 件と返信 3 件を UI から送り、B が開いて「コメントをさらに読み込む」を 2 回。境界の P3 | PASS。最初は 20 件とボタン、1 回で 40 件（ボタンあり）、2 回で 45 件（ボタンは消える。重複なし、古い順に 01 から 45 まで抜けなし）。返信は古い順（返信 1・2・3）。DB は親 45 + 返信 3 の 48 件。B のアバターはコメント欄で読み込まれる。P3 にはボタンが出ない | 押す前 [1280](evidence/epic-0006-r2/ac6-before-1280.png)、[768](evidence/epic-0006-r2/ac6-before-768.png)、[375](evidence/epic-0006-r2/ac6-before-375.png)、押した後 [1280](evidence/epic-0006-r2/ac6-after-1280.png)、[768](evidence/epic-0006-r2/ac6-after-768.png)、[375](evidence/epic-0006-r2/ac6-after-375.png)、返信 [1280](evidence/epic-0006-r2/ac6-replies-1280.png)、[768](evidence/epic-0006-r2/ac6-replies-768.png)、[375](evidence/epic-0006-r2/ac6-replies-375.png) |
| AC-7 | 3 幅で Tab・Enter・Esc だけで、いいね → 件数から一覧 → Esc → コメントの送信。axe を 6 つの状態 × 3 幅。状態の示し方。JS を切ったフォーム | PASS。3 幅とも Tab でハート・件数・コメント欄・「投稿」に届き（12・16・18 個）、キーボードだけで操作できる。読み上げ文は「いいね済み（1 件）」。形（`fill`）と `aria-pressed` で状態を示す。axe の重大・深刻な違反は全 18 回で 0 件。JS 無しでは、ハートのフォームで いいね・取り消しができ（DB の行 1 → 0）、セッション切れで送ると `/accounts/login` に移り行は作られず、存在しない投稿は HTTP 404 | キーボードでいいね（幅 1280） [1280](evidence/epic-0006-r2/ac7-kbd-liked-w1280-1280.png)、[768](evidence/epic-0006-r2/ac7-kbd-liked-w1280-768.png)、[375](evidence/epic-0006-r2/ac7-kbd-liked-w1280-375.png)、JS 無し 前 [1280](evidence/epic-0006-r2/nojs-before-1280.png)、[768](evidence/epic-0006-r2/nojs-before-768.png)、[375](evidence/epic-0006-r2/nojs-before-375.png)、JS 無し いいね後 [1280](evidence/epic-0006-r2/nojs-liked-1280.png)、[768](evidence/epic-0006-r2/nojs-liked-768.png)、[375](evidence/epic-0006-r2/nojs-liked-375.png)、ログインへの移動 [1280](evidence/epic-0006-r2/nojs-login-redirect-1280.png)、[768](evidence/epic-0006-r2/nojs-login-redirect-768.png)、[375](evidence/epic-0006-r2/nojs-login-redirect-375.png)、存在しない投稿 [1280](evidence/epic-0006-r2/nojs-unknown-post-1280.png)、[768](evidence/epic-0006-r2/nojs-unknown-post-768.png)、[375](evidence/epic-0006-r2/nojs-unknown-post-375.png) |

### キーボードで届くか

375px の `/p/<id>`（B でログイン、コメントが 2 件ある投稿）の Tab の順（[summary.json](evidence/epic-0006-r2/summary.json) の `tabOrder`）: 本文へ移動 → 作者 → いいね → 件数 → コメント 2 件のリンク → 作者 → 返信する・削除（コメントごと）→ コメント欄 → 下のナビ → 先頭へ。1280・768 でも同じ項目に届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0006-r2/summary.json) の `health`。出来事があった手順だけ載る）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（47 人）、投稿の作成、投稿詳細（いいね・ダブルタップ・取り消し・一覧のダイアログ・45 人のスクロール・コメント・返信・削除の確認・追加読み込み・キーボード操作）、ログアウト中の投稿詳細 | 0 | 0 |
| AC-3 で通信を落とした間（`abort` 1 回、500 応答 1 回） | `Failed to load resource` 2 件（`ERR_FAILED` と 500。わざと起こした失敗） | POST 1 件と 500 応答 1 件。これも起こした失敗 |
| AC-5 で削除の通信を落とした間 | `Failed to load resource` 1 件（`ERR_FAILED`。わざと起こした失敗） | POST 1 件。これも起こした失敗 |
| JS を切ったコンテキスト（JS 無しの手順） | 存在しない投稿へ送った分の `404` 2 件（わざと起こした） | JS のチャンクの GET が `csp` で止まった記録（JS を切ったため Chrome が読み込みを止める。製品の不具合ではない）。フォーム自体の通信の失敗は 0 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止めて実行。`uptime` の load は 15 前後）。typecheck・lint・format・docs・unit（443）・integration（226、4 件は想定の skip）・build・perf-budget（初期 JS 150,793 バイト、上限 170,000）・e2e（139 件。子 PBI の `like.spec.ts`・`comment.spec.ts` を含む）が全て OK。記録: [verify.txt](evidence/epic-0006-r2/verify.txt) | 0 |

## 見つけた問題

なし。

（既知で、このレポートの結果に影響しないもの）失敗した削除のあとの最初の Tab でフォーカスが body に落ちる（[#76](https://github.com/ohta-rh/insta-modoki/issues/76)）。AC-5 の手順で再現した（`afterFailedDeleteFirstTab: BODY`）。失敗の無い削除の確認を Esc で閉じるとフォーカスは開いたボタンに戻る。
