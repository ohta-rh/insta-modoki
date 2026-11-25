---
type: TestReport
title: EPIC #6 リアクション（いいね・コメント）の総合試験（1 回目）
description: 統合ブランチ m1/local-mvp の 18c2158 で、EPIC #6 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。全て満たし、コンソールの警告・エラーと失敗した通信は 0（AC-3 のために起こした失敗を除く）で、PASS。
tags: [epic-test]
---

# EPIC #6 リアクションの総合試験（1 回目）

## 対象

- EPIC: [#6](https://github.com/ohta-rh/insta-modoki/issues/6)（子 PBI #34 いいね・#35 コメント。#74 で一覧のダイアログが二重に開く不具合を直した後）
- 試験した commit: `18c2158`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22（実行は 2026-11-21 の深夜から）
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`、バケット `insta-s3`、`slot reset 3` で空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データは全て UI から作った。利用者は A（投稿者）・B・C の 3 人と、いいね用の 21 人（実際のサインアップ）。パスワードは実行時に生成し、どこにも書いていない。写真は `sharp` で作った 1000x1000 の JPEG。1 回目の実行は試験用の手順の誤り（取り消されないルートの外し方、Tab の名前の取り方、カウンタの書式の想定）で 4 項目が落ちたため、手順を直し、スロットを空にして全部やり直した。ここに載せるのはやり直しの結果。
- 項目ごとのデータと axe・ブラウザの状態: [summary.json](evidence/epic-0006/summary.json)

## 結果

PASS。AC-1〜AC-7 を全て満たした。コンソールのエラー・警告と失敗した通信は、AC-3 のために通信を落とした分を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 利用者 B で A の投稿 P1 を開き、写真をダブルクリック（ダブルタップ）。再読み込み。もう一度ダブルタップして再読み込み。失敗の経路として、ログアウトしたままダブルタップ | PASS。押した直後にハートが塗りつぶし（`aria-pressed=true`・`fill=currentColor`）で「1 件のいいね」。再読み込みしても残る。2 回目のダブルタップでも取り消されず（`aria-pressed=true`・1 件）、再読み込みしても同じ。ログアウト中は `/accounts/login` に移り、ハートは出ない（0 個） | 直後 [1280](evidence/epic-0006/ac1-after-doubletap-1280.png)、[768](evidence/epic-0006/ac1-after-doubletap-768.png)、[375](evidence/epic-0006/ac1-after-doubletap-375.png)、再読み込み後 [1280](evidence/epic-0006/ac1-after-reload-1280.png)、[768](evidence/epic-0006/ac1-after-reload-768.png)、[375](evidence/epic-0006/ac1-after-reload-375.png)、2 回目 [1280](evidence/epic-0006/ac1-second-doubletap-1280.png)、[768](evidence/epic-0006/ac1-second-doubletap-768.png)、[375](evidence/epic-0006/ac1-second-doubletap-375.png)、ログアウト中 [1280](evidence/epic-0006/ac1-signed-out-1280.png)、[768](evidence/epic-0006/ac1-signed-out-768.png)、[375](evidence/epic-0006/ac1-signed-out-375.png) |
| AC-2 | P1 でハートを押して取り消す。21 人が実際にサインアップして P2 にいいね（UI）。B が件数から一覧を開き、一覧をスクロール、Esc。失敗・空の経路として、0 件の P1 で件数から一覧を開く | PASS。ハートで取り消され、`fill=none`・件数 1 → 0、再読み込みしても 0。21 人の P2 は件数「21 件のいいね」から開くと 20 人、一番下までスクロールすると 21 人（重複なし）。Esc で閉じ、フォーカスは件数のボタンに戻る。0 件では「まだいいねはありません」 | 取り消し [1280](evidence/epic-0006/ac2-unliked-1280.png)、[768](evidence/epic-0006/ac2-unliked-768.png)、[375](evidence/epic-0006/ac2-unliked-375.png)、一覧 20 人 [1280](evidence/epic-0006/ac2-likers-20-1280.png)、[768](evidence/epic-0006/ac2-likers-20-768.png)、[375](evidence/epic-0006/ac2-likers-20-375.png)、一覧 21 人 [1280](evidence/epic-0006/ac2-likers-21-1280.png)、[768](evidence/epic-0006/ac2-likers-21-768.png)、[375](evidence/epic-0006/ac2-likers-21-375.png)、Esc 後 [1280](evidence/epic-0006/ac2-after-esc-1280.png)、[768](evidence/epic-0006/ac2-after-esc-768.png)、[375](evidence/epic-0006/ac2-after-esc-375.png)、空の一覧 [1280](evidence/epic-0006/ac2-likers-empty-1280.png)、[768](evidence/epic-0006/ac2-likers-empty-768.png)、[375](evidence/epic-0006/ac2-likers-empty-375.png) |
| AC-3 | `page.route` で P1 の Server Action（POST）を、(a) `abort`、(b) 状態 500 の応答にして、ハートを押す。通信を戻して押す | PASS。押した直後は `aria-pressed=true`（楽観的更新）、失敗すると `false`・0 件に戻り、「エラーが発生しました。しばらくしてからもう一度お試しください」が `role="alert"` で出る。(a)(b) とも同じ。通信を戻すと、いいねでき、再読み込みしても残る | 巻き戻し [1280](evidence/epic-0006/ac3-rolled-back-1280.png)、[768](evidence/epic-0006/ac3-rolled-back-768.png)、[375](evidence/epic-0006/ac3-rolled-back-375.png) |
| AC-4 | B が P3 にコメントを送り、そのコメントに返信し、再読み込み。失敗の経路として、空の入力と 2,201 字 | PASS。コメントは一覧の末尾にすぐ出て、返信は親より 44px 字下げ（1 階層）。再読み込みしても両方残り字下げも同じ。空の入力は「投稿」が無効で「まだコメントはありません」が出る。2,201 字はカウンタ `2201 / 2,200` が出て、送ると「コメントは 2,200 字までです」で、コメントは増えない | 空の状態 [1280](evidence/epic-0006/ac4-empty-1280.png)、[768](evidence/epic-0006/ac4-empty-768.png)、[375](evidence/epic-0006/ac4-empty-375.png)、コメントと返信 [1280](evidence/epic-0006/ac4-comment-and-reply-1280.png)、[768](evidence/epic-0006/ac4-comment-and-reply-768.png)、[375](evidence/epic-0006/ac4-comment-and-reply-375.png)、再読み込み後 [1280](evidence/epic-0006/ac4-after-reload-1280.png)、[768](evidence/epic-0006/ac4-after-reload-768.png)、[375](evidence/epic-0006/ac4-after-reload-375.png)、2,201 字 [1280](evidence/epic-0006/ac4-too-long-1280.png)、[768](evidence/epic-0006/ac4-too-long-768.png)、[375](evidence/epic-0006/ac4-too-long-375.png) |
| AC-5 | B（A の投稿では他人）で P3 を見る。B が自分の返信の「削除」→確認で「キャンセル」→もう一度「削除」→確認。投稿者 A が C のコメントを「削除」→確認。第三者 C で見る | PASS。B には A・C のコメントの「削除」が 0 個で、自分の親・返信にだけ 1 個ずつ。確認で「キャンセル」すると消えない。確認すると消え、再読み込みしても戻らない。A には全てのコメントに「削除」があり、C のコメントを確認して消すと再読み込みしても戻らない。C には「削除」が出ない | B の画面 [1280](evidence/epic-0006/ac5-b-view-no-delete-on-others-1280.png)、[768](evidence/epic-0006/ac5-b-view-no-delete-on-others-768.png)、[375](evidence/epic-0006/ac5-b-view-no-delete-on-others-375.png)、自分の確認 [1280](evidence/epic-0006/ac5-confirm-own-1280.png)、[768](evidence/epic-0006/ac5-confirm-own-768.png)、[375](evidence/epic-0006/ac5-confirm-own-375.png)、自分の削除後 [1280](evidence/epic-0006/ac5-after-delete-own-1280.png)、[768](evidence/epic-0006/ac5-after-delete-own-768.png)、[375](evidence/epic-0006/ac5-after-delete-own-375.png)、A の画面 [1280](evidence/epic-0006/ac5-author-view-1280.png)、[768](evidence/epic-0006/ac5-author-view-768.png)、[375](evidence/epic-0006/ac5-author-view-375.png)、他人のコメントの確認 [1280](evidence/epic-0006/ac5-confirm-others-1280.png)、[768](evidence/epic-0006/ac5-confirm-others-768.png)、[375](evidence/epic-0006/ac5-confirm-others-375.png)、他人のコメントの削除後 [1280](evidence/epic-0006/ac5-after-delete-others-1280.png)、[768](evidence/epic-0006/ac5-after-delete-others-768.png)、[375](evidence/epic-0006/ac5-after-delete-others-375.png) |
| AC-6 | C が P4 に 21 件のコメントを UI から送り、B が P4 を開いて「コメントをさらに読み込む」を押す。境界として 21 件に満たない P3 | PASS。最初は 20 件とボタン。押すと 21 件（重複なし、「親コメント 21」あり）でボタンは消える。P3 にはボタンが出ない | 押す前 [1280](evidence/epic-0006/ac6-before-1280.png)、[768](evidence/epic-0006/ac6-before-768.png)、[375](evidence/epic-0006/ac6-before-375.png)、押した後 [1280](evidence/epic-0006/ac6-after-1280.png)、[768](evidence/epic-0006/ac6-after-768.png)、[375](evidence/epic-0006/ac6-after-375.png) |
| AC-7 | 3 幅で Tab・Enter・Esc だけで、いいね → 件数から一覧 → Esc → コメントの入力と送信。axe（`@axe-core/playwright`）を 6 つの状態 × 3 幅で。状態の示し方。コンソールと通信 | PASS。3 幅とも Tab でハート・件数・コメント欄・「投稿」に順に届き（13・15・19 個）、キーボードだけで上の操作ができる。読み上げの文は「いいね済み（1 件）」。一覧のダイアログでは Tab がダイアログの中に留まる。いいね前は `aria-pressed=false`・輪郭（`fill=none`）、後は `true`・塗りつぶし・「1 件のいいね」で、色だけではない。axe の重大・深刻な違反は全 18 回で 0 件。コンソールのエラー・警告は 0、失敗した通信は 0（試験のために起こした AC-3 の失敗を除く。下の表）。#74 の「一覧が開き済み」警告は出ない | キーボードでいいね 1280 [1280](evidence/epic-0006/ac7-kbd-liked-w1280-1280.png)、[768](evidence/epic-0006/ac7-kbd-liked-w1280-768.png)、[375](evidence/epic-0006/ac7-kbd-liked-w1280-375.png)、768 [1280](evidence/epic-0006/ac7-kbd-liked-w768-1280.png)、[768](evidence/epic-0006/ac7-kbd-liked-w768-768.png)、[375](evidence/epic-0006/ac7-kbd-liked-w768-375.png)、375 [1280](evidence/epic-0006/ac7-kbd-liked-w375-1280.png)、[768](evidence/epic-0006/ac7-kbd-liked-w375-768.png)、[375](evidence/epic-0006/ac7-kbd-liked-w375-375.png) |

### キーボードで届くか

375px の `/p/<id>`（B でログイン、コメントが 2 件ある投稿）の Tab の順（[summary.json](evidence/epic-0006/summary.json) の `tabOrder`）: 本文へ移動 → 作者 → いいね → 件数 → コメント 2 件のリンク → 作者 → 返信する・削除（コメントごと）→ コメント欄 → 下のナビ（ホーム・検索・投稿・通知・プロフィール）→ 先頭へ。1280・768 でも同じ項目に届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0006/summary.json) の `health`。出来事があった手順だけ載る）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（24 人）、投稿の作成（4 件）、投稿詳細（いいね・ダブルタップ・取り消し・一覧のダイアログ・コメント・返信・削除の確認・追加読み込み・キーボード操作）、ログアウト中の投稿詳細 | 0 | 0 |
| AC-3 で通信を落とした間（`abort` 1 回、500 応答 1 回） | `Failed to load resource` 2 件（`ERR_FAILED` と 500。試験のために起こした失敗で、想定どおり。製品の問題ではない） | POST 1 件（`abort`）と 500 応答 1 件。これも起こした失敗 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（アプリのサーバーを止めて実行。`uptime` の load は 5〜7）。typecheck・lint・format・docs・unit（385）・integration（226、4 件は想定の skip）・build・e2e（117 件。子 PBI の `like.spec.ts`（#74 の警告が出ない試験を含む）・`comment.spec.ts` を含む）が全て OK。記録: [verify.txt](evidence/epic-0006/verify.txt) | 0 |

## 見つけた問題

なし。

（製品の不具合ではない、気づき）ログアウト中に写真をダブルタップすると、いいねの代わりに `/accounts/login` へ移る。AC には無い動き。失敗の経路の記録として載せた。
