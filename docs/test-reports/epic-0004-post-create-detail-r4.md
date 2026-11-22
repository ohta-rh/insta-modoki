---
type: TestReport
title: EPIC #4 投稿（複数の写真の投稿・投稿詳細・グリッドのモーダル・削除）の総合試験（4 回目）
description: バグ #76（削除ダイアログで通信が失敗したあと focus が body に落ちる）の修正 42d6e49..265411e の後の統合ブランチ m1/local-mvp（265411e）で、EPIC #4 の 6 つの受け入れ条件を実ブラウザ（Google Chrome 157）でやり直した（ADR-0048）。3 回目の懸念は解消し、投稿とコメントの削除ダイアログは通信中も失敗後も focus が中に留まる。結果は PASS。
tags: [epic-test]
---

# EPIC #4 投稿の総合試験（4 回目）

## 対象

- EPIC: [#4](https://github.com/ohta-rh/insta-modoki/issues/4)。1 回目: [epic-0004-post-create-detail.md](epic-0004-post-create-detail.md)（FAIL）、2 回目: [epic-0004-post-create-detail-r2.md](epic-0004-post-create-detail-r2.md)（PASS）、3 回目: [epic-0004-post-create-detail-r3.md](epic-0004-post-create-detail-r3.md)（PASS、懸念 1 件）
- 試験した commit: `265411e`（統合ブランチ `m1/local-mvp`、worktree のブランチ `epic-test/4`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- やり直す理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。3 回目の懸念をバグ #76 として直した（42d6e49..265411e。削除ダイアログのボタンの `disabled` を `aria-disabled` にし、通信中の二重送信を止め、通信中は「キャンセル」と Esc で閉じない）。投稿の削除ダイアログとコメントの削除ダイアログの両方が対象。
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`、バケット `insta-s1`、空の状態から）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP のプロファイルは別のセッションが握っていて 2 回とも起動に失敗したため、[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり Playwright の `channel: 'chrome'`・`headless: false`（使い捨てのプロファイル）の Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。データは全て UI から作った（利用者 2 人。パスワードは実行時に生成し、記録していない）。
- 3 回目との違い: 削除ダイアログの手順を #76 の確認に置き換えた。削除の通信を Playwright の `page.route` で保留（通信中）→ 中断（失敗）して、各 `document.activeElement` を記録した。投稿・コメントの両方で同じ手順を行った。
- AC-3 のバケットの一覧は `.dev.vars` の鍵で署名した S3 ListObjectsV2 で取った（鍵は記録していない）。AC-5 の EXIF は `sharp` の `metadata()` で調べた。
- 項目ごとのデータ: [summary.json](evidence/epic-0004-r4/summary.json)、focus の記録: [ac3-focus-r4.txt](evidence/epic-0004-r4/ac3-focus-r4.txt)

## 結果

PASS。AC-1〜AC-6 を全て満たした。3 回目の懸念（削除の通信が失敗したあと focus が body に落ちる）は #76 の修正で解消した。投稿の削除ダイアログとコメントの削除ダイアログのどちらも、通信中は「キャンセル」・Esc で閉じず 2 回目の Enter でも送信は 1 件、失敗後は Tab 5 回・Shift+Tab 5 回ずっと focus がダイアログの中、Esc で閉じて focus が「削除」に戻る。コンソールの警告は 0。エラーと失敗した通信は、想定した 404 と、わざと止めた通信を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `/create` で写真 3 枚（赤・緑・青、サイズも形式も別）を選び、1:1 に切り抜き、代替テキスト 3 つとキャプションを入れて投稿。矢印キーで送る。失敗・空の経路: 写真 0 枚の `/create` | PASS。`/p/<uuid>` に移り、バッジ `1/3`、ドット 3 つ、スライド 3 枚。保存された色は選んだ順（赤・緑・青）で全て 640x640、`alt` は選んだとおり、キャプションが出る。ArrowRight で `2/3`（3 幅とも）、→→で `3/3`、←で `2/3`。バケットに新しいファイル 12 個（3 枚 × 4）。空の `/create` は「投稿」が無効 | 空 [1280](evidence/epic-0004-r4/ac1-create-empty-1280.png)・[768](evidence/epic-0004-r4/ac1-create-empty-768.png)・[375](evidence/epic-0004-r4/ac1-create-empty-375.png)、入力済み [1280](evidence/epic-0004-r4/ac1-create-filled-1280.png)・[768](evidence/epic-0004-r4/ac1-create-filled-768.png)・[375](evidence/epic-0004-r4/ac1-create-filled-375.png)、投稿後 [1280](evidence/epic-0004-r4/ac1-post-1of3-1280.png)・[768](evidence/epic-0004-r4/ac1-post-1of3-768.png)・[375](evidence/epic-0004-r4/ac1-post-1of3-375.png)、矢印キー [1280](evidence/epic-0004-r4/ac1-post-2of3-arrowkey-1280.png)・[768](evidence/epic-0004-r4/ac1-post-2of3-arrowkey-768.png)・[375](evidence/epic-0004-r4/ac1-post-2of3-arrowkey-375.png) |
| AC-2 | プロフィールに 10 件の投稿を作り、各幅（高さ 700）で画面内のタイルをクリック。Esc で閉じる。同じ URL を新しいタブで開く。失敗の経路: 存在しない `/p/<id>`、削除済みの投稿（通常のページと、グリッドに残っていたタイルから開いたモーダル） | PASS。モーダルで開き URL が `/p/<id>`。Esc でプロフィールの URL に戻り、スクロール位置は同じ（クリック前と Esc 後で同じ値）。新しいタブでは同じ URL がダイアログ無しの通常のページ。存在しない `/p/<id>` は 404。削除済みの投稿のタイルから開いたモーダルは「ページが見つかりません」（URL は `/p/<id>`）、通常のページは HTTP 404 | スクロール後 [1280](evidence/epic-0004-r4/ac2-profile-scrolled-1280.png)・[768](evidence/epic-0004-r4/ac2-profile-scrolled-768.png)・[375](evidence/epic-0004-r4/ac2-profile-scrolled-375.png)、モーダル [1280](evidence/epic-0004-r4/ac2-modal-open-1280.png)・[768](evidence/epic-0004-r4/ac2-modal-open-768.png)・[375](evidence/epic-0004-r4/ac2-modal-open-375.png)、Esc 後 [1280](evidence/epic-0004-r4/ac2-after-esc-1280.png)・[768](evidence/epic-0004-r4/ac2-after-esc-768.png)・[375](evidence/epic-0004-r4/ac2-after-esc-375.png)、新しいタブ [1280](evidence/epic-0004-r4/ac2-newtab-page-1280.png)・[768](evidence/epic-0004-r4/ac2-newtab-page-768.png)・[375](evidence/epic-0004-r4/ac2-newtab-page-375.png)、404 [1280](evidence/epic-0004-r4/ac2-unknown-post-404-1280.png)・[768](evidence/epic-0004-r4/ac2-unknown-post-404-768.png)・[375](evidence/epic-0004-r4/ac2-unknown-post-404-375.png)、削除済みのモーダル [1280](evidence/epic-0004-r4/ac2-modal-deleted-post-1280.png)・[768](evidence/epic-0004-r4/ac2-modal-deleted-post-768.png)・[375](evidence/epic-0004-r4/ac2-modal-deleted-post-375.png)、削除済みの通常のページ [1280](evidence/epic-0004-r4/ac2-deleted-post-page-404-1280.png)・[768](evidence/epic-0004-r4/ac2-deleted-post-page-404-768.png)・[375](evidence/epic-0004-r4/ac2-deleted-post-page-404-375.png) |
| AC-3 | 他の利用者（B）で投稿を開く。B がいいねし、A が「1 件のいいね」から一覧を開く（0 件では空の状態）。A で「削除」→確認ダイアログ→「削除」。前後でバケットを一覧。削除後にプロフィールと投稿の URL を開く。ダイアログを Enter で開き Tab 7 回・Shift+Tab 4 回、Esc、「キャンセル」。**#76 の再確認**（下の表） | PASS。B の画面に「削除」は 0 個、A は 1 個。一覧に B の 1 人、0 件では「まだいいねはありません」。バケットは削除前 48 個 → 後 36 個で、消えたのは 12 個、その投稿のファイルは 0 個残る。グリッドから消え、投稿の URL は 404。ダイアログは「キャンセル」に focus があり、Tab・Shift+Tab の 11 回の間ずっとダイアログの中。Esc と「キャンセル」で閉じ、どちらも focus は「削除」に戻り、投稿は残る | 他人 [1280](evidence/epic-0004-r4/ac3-other-user-no-delete-1280.png)・[768](evidence/epic-0004-r4/ac3-other-user-no-delete-768.png)・[375](evidence/epic-0004-r4/ac3-other-user-no-delete-375.png)、一覧 [1280](evidence/epic-0004-r4/ac3-likers-dialog-1280.png)・[768](evidence/epic-0004-r4/ac3-likers-dialog-768.png)・[375](evidence/epic-0004-r4/ac3-likers-dialog-375.png)、一覧（0 件） [1280](evidence/epic-0004-r4/ac3-likers-empty-1280.png)・[768](evidence/epic-0004-r4/ac3-likers-empty-768.png)・[375](evidence/epic-0004-r4/ac3-likers-empty-375.png)、確認 [1280](evidence/epic-0004-r4/ac3-confirm-dialog-1280.png)・[768](evidence/epic-0004-r4/ac3-confirm-dialog-768.png)・[375](evidence/epic-0004-r4/ac3-confirm-dialog-375.png)、focus の閉じ込め [1280](evidence/epic-0004-r4/ac3-focus-dialog-1280.png)・[768](evidence/epic-0004-r4/ac3-focus-dialog-768.png)・[375](evidence/epic-0004-r4/ac3-focus-dialog-375.png)、削除後 [1280](evidence/epic-0004-r4/ac3-after-delete-profile-1280.png)・[768](evidence/epic-0004-r4/ac3-after-delete-profile-768.png)・[375](evidence/epic-0004-r4/ac3-after-delete-profile-375.png)、404 [1280](evidence/epic-0004-r4/ac3-deleted-404-1280.png)・[768](evidence/epic-0004-r4/ac3-deleted-404-768.png)・[375](evidence/epic-0004-r4/ac3-deleted-404-375.png)、投稿の削除・通信中 [1280](evidence/epic-0004-r4/ac3-post-delete-inflight-1280.png)・[768](evidence/epic-0004-r4/ac3-post-delete-inflight-768.png)・[375](evidence/epic-0004-r4/ac3-post-delete-inflight-375.png)、投稿の削除・失敗 [1280](evidence/epic-0004-r4/ac3-post-delete-error-message-1280.png)・[768](evidence/epic-0004-r4/ac3-post-delete-error-message-768.png)・[375](evidence/epic-0004-r4/ac3-post-delete-error-message-375.png)、コメントの削除・通信中 [1280](evidence/epic-0004-r4/ac3-comment-delete-inflight-1280.png)・[768](evidence/epic-0004-r4/ac3-comment-delete-inflight-768.png)・[375](evidence/epic-0004-r4/ac3-comment-delete-inflight-375.png)、コメントの削除・失敗 [1280](evidence/epic-0004-r4/ac3-comment-delete-error-message-1280.png)・[768](evidence/epic-0004-r4/ac3-comment-delete-error-message-768.png)・[375](evidence/epic-0004-r4/ac3-comment-delete-error-message-375.png)、[削除前の一覧](evidence/epic-0004-r4/ac3-bucket-before.txt)、[削除後の一覧](evidence/epic-0004-r4/ac3-bucket-after.txt)、[focus の記録](evidence/epic-0004-r4/ac3-focus-r4.txt) |
| AC-4 | 10 枚のあとに 11 枚目。10MB 超（10,491,823 バイト）の JPEG。GIF。2,201 字のキャプション。それぞれで送信した通信を数える。写真の送信の通信が失敗したとき | PASS。「写真は 10 枚までです」（10 枚のまま）、「too-large.jpg: ファイルが大きすぎます（1 枚 10MB まで）」、「not-allowed.gif: この形式は使えません（JPEG・PNG・WebP・HEIC）」、「キャプションは 2,200 字までです」（「投稿」は無効）。4 つとも通信は 0 件。送信の通信を止めると「アップロードに失敗しました。もう一度お試しください」が出て、選んだ写真は残り「投稿」は再び押せる | 11 枚目 [1280](evidence/epic-0004-r4/ac4-11th-photo-1280.png)・[768](evidence/epic-0004-r4/ac4-11th-photo-768.png)・[375](evidence/epic-0004-r4/ac4-11th-photo-375.png)、10MB 超 [1280](evidence/epic-0004-r4/ac4-too-large-1280.png)・[768](evidence/epic-0004-r4/ac4-too-large-768.png)・[375](evidence/epic-0004-r4/ac4-too-large-375.png)、GIF [1280](evidence/epic-0004-r4/ac4-gif-1280.png)・[768](evidence/epic-0004-r4/ac4-gif-768.png)・[375](evidence/epic-0004-r4/ac4-gif-375.png)、2,201 字 [1280](evidence/epic-0004-r4/ac4-caption-2201-1280.png)・[768](evidence/epic-0004-r4/ac4-caption-2201-768.png)・[375](evidence/epic-0004-r4/ac4-caption-2201-375.png)、送信の失敗 [1280](evidence/epic-0004-r4/ac4-upload-failure-1280.png)・[768](evidence/epic-0004-r4/ac4-upload-failure-768.png)・[375](evidence/epic-0004-r4/ac4-upload-failure-375.png) |
| AC-5 | GPS つきの JPEG（35.66 N・139.75 E）を投稿し、保存された 4 つのファイルをメディアのオリジンから取って `sharp` で EXIF を調べる | PASS。元の写真は GPS の項目 4 つ（タグ 1〜4）を持つ。保存された `orig`・`w320`・`w640`・`w1080` はどれも `metadata().exif` が無く、`Exif`・`GPS` の文字列もバイト列に無い | [元の写真](evidence/epic-0004-r4/ac5-source-exif.txt)、[保存された 4 つ](evidence/epic-0004-r4/ac5-stored-exif.txt)、投稿 [1280](evidence/epic-0004-r4/ac5-post-1280.png)・[768](evidence/epic-0004-r4/ac5-post-768.png)・[375](evidence/epic-0004-r4/ac5-post-375.png) |
| AC-6 | CDP で 400kbps・遅延 400ms・キャッシュ無し、写真の通信を 5 秒止めて投稿詳細を開く。`layout-shift` で CLS を測る。HTML を Cookie 無しで取り `og:*`・`twitter:*` を見る | PASS。写真が届く前の枠は 600x600・524x524・375x375 で、届いたあとも同じ。CLS は 1280: 0.0001、768: 0.0002、375: 0.0078（0.1 以下）。HTML に `og:title`・`og:description`・`og:url`・`og:image`・`og:type`・`twitter:card`・`twitter:title` が入る | 読み込み前 [1280](evidence/epic-0004-r4/ac6-loading-1280.png)・[768](evidence/epic-0004-r4/ac6-loading-768.png)・[375](evidence/epic-0004-r4/ac6-loading-375.png)、読み込み後 [1280](evidence/epic-0004-r4/ac6-loaded-1280.png)・[768](evidence/epic-0004-r4/ac6-loaded-768.png)・[375](evidence/epic-0004-r4/ac6-loaded-375.png)、[OGP のタグ](evidence/epic-0004-r4/ac6-og-meta.txt) |

### #76 の再確認（削除ダイアログの focus）

削除の通信（Server Action の POST）を保留して通信中を作り、そのあと中断して失敗させた。記録は [ac3-focus-r4.txt](evidence/epic-0004-r4/ac3-focus-r4.txt)。投稿とコメントで結果は同じ。

| 手順 | 投稿の削除ダイアログ | コメントの削除ダイアログ |
|---|---|---|
| Tab で「削除」に移り Enter（通信中） | 「削除中…」に focus、ダイアログの中、送信 1 件 | 同じ |
| 通信中の「キャンセル」の押下 | 閉じない（open=true） | 閉じない |
| 通信中の Esc | 閉じない（open=true） | 閉じない |
| 通信中の 2 回目の Enter | 送信は 1 件のまま | 1 件のまま |
| 2 つのボタンの `aria-disabled` | 両方 `true` | 両方 `true` |
| 失敗のメッセージ（「エラーが発生しました。しばらくしてからもう一度お試しください」）の直後 | focus は「キャンセル」（ダイアログの中。3 回目は body だった） | 同じ |
| Tab 5 回 | 削除 → キャンセル → 削除 → キャンセル → 削除（全て中） | 同じ |
| Shift+Tab 5 回 | キャンセル → 削除 → キャンセル → 削除 → キャンセル（全て中） | 同じ |
| Esc | 閉じ、focus は「削除」（押したボタン）に戻る | 閉じ、focus はそのコメントの「削除」ボタンに戻る |

コメントの focus の戻り先は、記録の文字列が 20 字で切れて「@ep4_… のコ」になっている（ボタンの名前は「@<利用者> のコメントを削除」）。試験の走行がこれを「削除」の始まりと照合して NG と出したが、照合の書き方の誤りで、focus はコメントの削除ボタンに戻っている。

### キーボードで届くか

Tab だけで全ての操作に届いた（[summary.json](evidence/epic-0004-r4/summary.json) の `tabOrder`）。`/create`（3 枚選択後）: ナビ → 写真を選ぶ → 比率 → 各写真の切り抜き・代替テキスト・前へ・後ろへ・外す → キャプション → 投稿。`/p/<id>`: ナビ → 作者 → 削除 → 写真 → 前の写真 → 次の写真 → いいね → 「0 件のいいね」 → コメント → 作者 → コメントの入力欄。削除ダイアログは Enter で開き、Tab はダイアログの中を回る。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0004-r4/summary.json) の `health`）。コンソールの警告は全体で 0。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（A・B）、`/create`（空・入力済み・投稿）、投稿詳細（カルーセル・矢印キー・遅い回線）、プロフィールのグリッドとモーダル・新しいタブ、削除済みの投稿のモーダル、AC-4 の 4 つの入力の境界、AC-5 の投稿、他人の投稿詳細、いいねの一覧（1 人・0 件）、削除の確認ダイアログ（開く・Tab・Esc・キャンセル）と削除の実行、コメントの投稿 | 0 | 0 |
| 存在しない `/p/<id>`、削除した投稿の `/p/<id>`、削除済みの投稿の通常のページ（想定した 404） | 各 1 件の `Failed to load resource ... 404` | 想定した 404 の応答 1 件ずつ |
| 投稿とコメントの削除の通信を止めた手順（わざと保留して `abort`） | 各 1 件の `net::ERR_FAILED` | 止めた POST 1 件ずつ |
| 写真の送信の通信を止めた手順（わざと `abort`）。同じ区間の末尾で、削除済みの投稿 `/p/<id>` を B で開いた想定の 404 1 件も数えた | `net::ERR_FAILED` 1 件と 404 の 1 件 | 止めた POST 1 件と想定した 404 1 件 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止めて実行、1 回目で通った）。typecheck・lint・format・docs・unit（443）・integration（226、4 件は skip）・build・e2e（143 件）・perf-budget が全て OK。記録: [verify.txt](evidence/epic-0004-r4/verify.txt) | 0 |

## 見つけた問題

なし。3 回目の懸念（削除の通信が失敗したあとの focus）は解消した。
