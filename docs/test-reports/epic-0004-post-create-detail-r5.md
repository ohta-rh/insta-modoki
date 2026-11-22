---
type: TestReport
title: EPIC #4 投稿（複数の写真の投稿・投稿詳細・グリッドのモーダル・削除）の総合試験（5 回目）
description: 修正 #80（ハイドレーション前に選んだファイルをマウント時に取り込む。ADR-0054）と #78 の後の統合ブランチ m1/local-mvp（c3a4a8e）で、EPIC #4 の 6 つの受け入れ条件を実ブラウザ（Google Chrome 157）でやり直し、#80 を JS を止めた状態と Slow 3G で確かめた（ADR-0048）。結果は PASS。
tags: [epic-test]
---

# EPIC #4 投稿の総合試験（5 回目）

## 対象

- EPIC: [#4](https://github.com/ohta-rh/insta-modoki/issues/4)。1 回目: [epic-0004-post-create-detail.md](epic-0004-post-create-detail.md)（FAIL）、2 回目: [r2](epic-0004-post-create-detail-r2.md)（PASS）、3 回目: [r3](epic-0004-post-create-detail-r3.md)（PASS、懸念 1 件）、4 回目: [r4](epic-0004-post-create-detail-r4.md)（PASS）
- 試験した commit: `c3a4a8e`（統合ブランチ `m1/local-mvp`、worktree のブランチ `epic-test/4`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- やり直す理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。4 回目のあとに #78（テストの時間切れの調整のみ）と #80（`/create` と画像選択部品とアイコン選択で、ハイドレーション前に選んだファイルをマウント時に取り込む。[ADR-0054](../adr/0054-pick-up-files-chosen-before-hydration-on-mount.md)）が入った。#80 は `/create`（EPIC #4 の画面）のコードを変えている。
- 日付: 2026-11-22
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`、バケット `insta-s3`、空の状態から）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP のプロファイルは別のセッションが握っていて 2 回とも起動に失敗したため、[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり Playwright の `channel: 'chrome'`・`headless: false`（使い捨てのプロファイル）の Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。データは全て UI から作った（利用者 2 人。パスワードは実行時に生成し、記録していない）。
- 4 回目との違い: AC-1〜AC-6 の手順は 4 回目と同じ。加えて #80 の確認（AC-4 の下の「#80 の確認」）を足した。読み込み前の状態は、スクリプト（`/_next/static/**/*.js`）の通信を Playwright の `page.route` で止めて作り、Tab で「写真を選ぶ」に移り Enter でキーボードから選択画面を開き、選択画面に写真を渡し、止めを外してハイドレーションさせた。Slow 3G は CDP の `Network.emulateNetworkConditions`（500kbps・遅延 400ms）。
- バケットの一覧は `.dev.vars` の鍵で署名した S3 ListObjectsV2、EXIF は `sharp` の `metadata()` で調べた（鍵は記録していない）。
- 項目ごとのデータ: [summary.json](evidence/epic-0004-r5/summary.json)

## 結果

PASS。AC-1〜AC-6 を全て満たした。#80 の修正は実ブラウザで効いている: ハイドレーション前に選んだ写真は、読み込みのあと一覧に入り（前は「0 / 10 枚」のまま）、投稿でき、二重にならず、11 枚・10MB 超の理由も出る。コンソールの警告は全体で 0。エラーと失敗した通信は、想定した 404 と、わざと止めた通信を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `/create` で写真 3 枚（赤・緑・青、サイズも形式も別）を選び、1:1 に切り抜き、代替テキスト 3 つとキャプションを入れて投稿。矢印キーで送る。失敗・空の経路: 写真 0 枚の `/create` | PASS。`/p/<uuid>` に移り、バッジ `1/3`、ドット 3 つ、スライド 3 枚。保存された色は選んだ順（赤・緑・青）で全て 640x640、`alt` は選んだとおり、キャプションが出る。ArrowRight で `2/3`（3 幅とも）、→→で `3/3`、←で `2/3`。バケットに新しいファイル 12 個。空の `/create` は「投稿」が無効 | 空 [1280](evidence/epic-0004-r5/ac1-create-empty-1280.png)・[768](evidence/epic-0004-r5/ac1-create-empty-768.png)・[375](evidence/epic-0004-r5/ac1-create-empty-375.png)、入力済み [1280](evidence/epic-0004-r5/ac1-create-filled-1280.png)・[768](evidence/epic-0004-r5/ac1-create-filled-768.png)・[375](evidence/epic-0004-r5/ac1-create-filled-375.png)、投稿後 [1280](evidence/epic-0004-r5/ac1-post-1of3-1280.png)・[768](evidence/epic-0004-r5/ac1-post-1of3-768.png)・[375](evidence/epic-0004-r5/ac1-post-1of3-375.png)、矢印キー [1280](evidence/epic-0004-r5/ac1-post-2of3-arrowkey-1280.png)・[768](evidence/epic-0004-r5/ac1-post-2of3-arrowkey-768.png)・[375](evidence/epic-0004-r5/ac1-post-2of3-arrowkey-375.png) |
| AC-2 | プロフィールに 10 件の投稿を作り、各幅で画面内のタイルをクリック。Esc で閉じる。同じ URL を新しいタブで開く。失敗の経路: 存在しない `/p/<id>`、削除済みの投稿（通常のページと、グリッドに残っていたタイルから開いたモーダル） | PASS。モーダルで開き URL が `/p/<id>`。Esc でプロフィールに戻り、スクロール位置は同じ（300 / 288.5 / 131.5）。新しいタブではダイアログ無しの通常のページ。存在しない `/p/<id>` は 404。削除済みのタイルのモーダルは「ページが見つかりません」、通常のページは HTTP 404 | スクロール後 [1280](evidence/epic-0004-r5/ac2-profile-scrolled-1280.png)・[768](evidence/epic-0004-r5/ac2-profile-scrolled-768.png)・[375](evidence/epic-0004-r5/ac2-profile-scrolled-375.png)、モーダル [1280](evidence/epic-0004-r5/ac2-modal-open-1280.png)・[768](evidence/epic-0004-r5/ac2-modal-open-768.png)・[375](evidence/epic-0004-r5/ac2-modal-open-375.png)、Esc 後 [1280](evidence/epic-0004-r5/ac2-after-esc-1280.png)・[768](evidence/epic-0004-r5/ac2-after-esc-768.png)・[375](evidence/epic-0004-r5/ac2-after-esc-375.png)、新しいタブ [1280](evidence/epic-0004-r5/ac2-newtab-page-1280.png)・[768](evidence/epic-0004-r5/ac2-newtab-page-768.png)・[375](evidence/epic-0004-r5/ac2-newtab-page-375.png)、404 [1280](evidence/epic-0004-r5/ac2-unknown-post-404-1280.png)・[768](evidence/epic-0004-r5/ac2-unknown-post-404-768.png)・[375](evidence/epic-0004-r5/ac2-unknown-post-404-375.png)、削除済みのモーダル [1280](evidence/epic-0004-r5/ac2-modal-deleted-post-1280.png)・[768](evidence/epic-0004-r5/ac2-modal-deleted-post-768.png)・[375](evidence/epic-0004-r5/ac2-modal-deleted-post-375.png)、削除済みの通常のページ [1280](evidence/epic-0004-r5/ac2-deleted-post-page-404-1280.png)・[768](evidence/epic-0004-r5/ac2-deleted-post-page-404-768.png)・[375](evidence/epic-0004-r5/ac2-deleted-post-page-404-375.png) |
| AC-3 | 他の利用者（B）で投稿を開く。B がいいねし、A が「1 件のいいね」から一覧を開く（0 件では空の状態）。A で「削除」→確認ダイアログ→「削除」。前後でバケットを一覧。削除後にプロフィールと投稿の URL を開く。ダイアログを Enter で開き Tab 7 回・Shift+Tab 4 回、Esc、「キャンセル」。削除の通信を止めた手順（#76 の再確認） | PASS。B の画面に「削除」は 0 個、A は 1 個。一覧に B の 1 人、0 件では「まだいいねはありません」。バケットは削除前 48 個 → 後 36 個で、消えたのは 12 個、その投稿のファイルは 0 個残る。グリッドから消え、投稿の URL は 404。ダイアログは「キャンセル」に focus があり 11 回の間ずっとダイアログの中、Esc と「キャンセル」で閉じて focus は「削除」に戻る。通信中は「キャンセル」・Esc で閉じず、2 回目の Enter でも送信は 1 件。失敗後も Tab 5 回・Shift+Tab 5 回ずっと中（投稿・コメントの両方） | 他人 [1280](evidence/epic-0004-r5/ac3-other-user-no-delete-1280.png)・[768](evidence/epic-0004-r5/ac3-other-user-no-delete-768.png)・[375](evidence/epic-0004-r5/ac3-other-user-no-delete-375.png)、一覧 [1280](evidence/epic-0004-r5/ac3-likers-dialog-1280.png)・[768](evidence/epic-0004-r5/ac3-likers-dialog-768.png)・[375](evidence/epic-0004-r5/ac3-likers-dialog-375.png)、一覧（0 件） [1280](evidence/epic-0004-r5/ac3-likers-empty-1280.png)・[768](evidence/epic-0004-r5/ac3-likers-empty-768.png)・[375](evidence/epic-0004-r5/ac3-likers-empty-375.png)、確認 [1280](evidence/epic-0004-r5/ac3-confirm-dialog-1280.png)・[768](evidence/epic-0004-r5/ac3-confirm-dialog-768.png)・[375](evidence/epic-0004-r5/ac3-confirm-dialog-375.png)、focus の閉じ込め [1280](evidence/epic-0004-r5/ac3-focus-dialog-1280.png)・[768](evidence/epic-0004-r5/ac3-focus-dialog-768.png)・[375](evidence/epic-0004-r5/ac3-focus-dialog-375.png)、削除後 [1280](evidence/epic-0004-r5/ac3-after-delete-profile-1280.png)・[768](evidence/epic-0004-r5/ac3-after-delete-profile-768.png)・[375](evidence/epic-0004-r5/ac3-after-delete-profile-375.png)、404 [1280](evidence/epic-0004-r5/ac3-deleted-404-1280.png)・[768](evidence/epic-0004-r5/ac3-deleted-404-768.png)・[375](evidence/epic-0004-r5/ac3-deleted-404-375.png)、投稿の削除・通信中 [1280](evidence/epic-0004-r5/ac3-post-delete-inflight-1280.png)・[768](evidence/epic-0004-r5/ac3-post-delete-inflight-768.png)・[375](evidence/epic-0004-r5/ac3-post-delete-inflight-375.png)、投稿の削除・失敗 [1280](evidence/epic-0004-r5/ac3-post-delete-error-message-1280.png)・[768](evidence/epic-0004-r5/ac3-post-delete-error-message-768.png)・[375](evidence/epic-0004-r5/ac3-post-delete-error-message-375.png)、コメントの削除・通信中 [1280](evidence/epic-0004-r5/ac3-comment-delete-inflight-1280.png)・[768](evidence/epic-0004-r5/ac3-comment-delete-inflight-768.png)・[375](evidence/epic-0004-r5/ac3-comment-delete-inflight-375.png)、コメントの削除・失敗 [1280](evidence/epic-0004-r5/ac3-comment-delete-error-message-1280.png)・[768](evidence/epic-0004-r5/ac3-comment-delete-error-message-768.png)・[375](evidence/epic-0004-r5/ac3-comment-delete-error-message-375.png)、[削除前の一覧](evidence/epic-0004-r5/ac3-bucket-before.txt)、[削除後の一覧](evidence/epic-0004-r5/ac3-bucket-after.txt)、[focus の記録](evidence/epic-0004-r5/ac3-focus-r5.txt) |
| AC-4 | 10 枚のあとに 11 枚目。10MB 超（10,491,823 バイト）の JPEG。GIF。2,201 字のキャプション。それぞれで送信した通信を数える。写真の送信の通信が失敗したとき。**#80:** 下の表 | PASS。「写真は 10 枚までです」（10 枚のまま）、「too-large.jpg: ファイルが大きすぎます（1 枚 10MB まで）」、「not-allowed.gif: この形式は使えません（JPEG・PNG・WebP・HEIC）」、「キャプションは 2,200 字までです」（「投稿」は無効）。4 つとも通信は 0 件。送信を止めると「アップロードに失敗しました。もう一度お試しください」が出て、選んだ写真は残り「投稿」は再び押せる | 11 枚目 [1280](evidence/epic-0004-r5/ac4-11th-photo-1280.png)・[768](evidence/epic-0004-r5/ac4-11th-photo-768.png)・[375](evidence/epic-0004-r5/ac4-11th-photo-375.png)、10MB 超 [1280](evidence/epic-0004-r5/ac4-too-large-1280.png)・[768](evidence/epic-0004-r5/ac4-too-large-768.png)・[375](evidence/epic-0004-r5/ac4-too-large-375.png)、GIF [1280](evidence/epic-0004-r5/ac4-gif-1280.png)・[768](evidence/epic-0004-r5/ac4-gif-768.png)・[375](evidence/epic-0004-r5/ac4-gif-375.png)、2,201 字 [1280](evidence/epic-0004-r5/ac4-caption-2201-1280.png)・[768](evidence/epic-0004-r5/ac4-caption-2201-768.png)・[375](evidence/epic-0004-r5/ac4-caption-2201-375.png)、送信の失敗 [1280](evidence/epic-0004-r5/ac4-upload-failure-1280.png)・[768](evidence/epic-0004-r5/ac4-upload-failure-768.png)・[375](evidence/epic-0004-r5/ac4-upload-failure-375.png)、#80: S1 読み込み前 [1280](evidence/epic-0004-r5/ac4-s1-before-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s1-before-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s1-before-hydration-375.png)、S1 後 [1280](evidence/epic-0004-r5/ac4-s1-after-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s1-after-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s1-after-hydration-375.png)、S1 投稿後 [1280](evidence/epic-0004-r5/ac4-s1-posted-1280.png)・[768](evidence/epic-0004-r5/ac4-s1-posted-768.png)・[375](evidence/epic-0004-r5/ac4-s1-posted-375.png)、S2 読み込み前 [1280](evidence/epic-0004-r5/ac4-s2-before-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s2-before-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s2-before-hydration-375.png)、S2 後 [1280](evidence/epic-0004-r5/ac4-s2-after-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s2-after-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s2-after-hydration-375.png)、S2 選び直し [1280](evidence/epic-0004-r5/ac4-s2-repick-1280.png)・[768](evidence/epic-0004-r5/ac4-s2-repick-768.png)・[375](evidence/epic-0004-r5/ac4-s2-repick-375.png)、S3 読み込み前 [1280](evidence/epic-0004-r5/ac4-s3-before-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s3-before-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s3-before-hydration-375.png)、S3 後 [1280](evidence/epic-0004-r5/ac4-s3-after-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s3-after-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s3-after-hydration-375.png)、S4 読み込み前 [1280](evidence/epic-0004-r5/ac4-s4-before-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s4-before-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s4-before-hydration-375.png)、S4 後 [1280](evidence/epic-0004-r5/ac4-s4-after-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s4-after-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s4-after-hydration-375.png)、S5 読み込み前 [1280](evidence/epic-0004-r5/ac4-s5-before-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s5-before-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s5-before-hydration-375.png)、S5 後 [1280](evidence/epic-0004-r5/ac4-s5-avatar-after-hydration-1280.png)・[768](evidence/epic-0004-r5/ac4-s5-avatar-after-hydration-768.png)・[375](evidence/epic-0004-r5/ac4-s5-avatar-after-hydration-375.png)、[記録](evidence/epic-0004-r5/ac4-hydration-r5.txt) |
| AC-5 | GPS つきの JPEG（35.66 N・139.75 E）を投稿し、保存された 4 つのファイルをメディアのオリジンから取って `sharp` で EXIF を調べる | PASS。元の写真は GPS の項目 4 つ（タグ 1〜4）を持つ。保存された `orig`・`w320`・`w640`・`w1080` はどれも `metadata().exif` が無く、`Exif`・`GPS` の文字列もバイト列に無い | 投稿 [1280](evidence/epic-0004-r5/ac5-post-1280.png)・[768](evidence/epic-0004-r5/ac5-post-768.png)・[375](evidence/epic-0004-r5/ac5-post-375.png)、[元の写真](evidence/epic-0004-r5/ac5-source-exif.txt)、[保存された 4 つ](evidence/epic-0004-r5/ac5-stored-exif.txt) |
| AC-6 | CDP で 400kbps・遅延 400ms・キャッシュ無し、写真の通信を 5 秒止めて投稿詳細を開く。`layout-shift` で CLS を測る。HTML を Cookie 無しで取り `og:*`・`twitter:*` を見る | PASS。枠は 600x600・524x524・375x375 で届いたあとも同じ。CLS は 1280: 0.0001、768: 0.0002、375: 0.0078（0.1 以下）。HTML に `og:title`・`og:description`・`og:url`・`og:image`・`og:type`・`twitter:card`・`twitter:title` が入る | 読み込み前 [1280](evidence/epic-0004-r5/ac6-loading-1280.png)・[768](evidence/epic-0004-r5/ac6-loading-768.png)・[375](evidence/epic-0004-r5/ac6-loading-375.png)、読み込み後 [1280](evidence/epic-0004-r5/ac6-loaded-1280.png)・[768](evidence/epic-0004-r5/ac6-loaded-768.png)・[375](evidence/epic-0004-r5/ac6-loaded-375.png)、[OGP のタグ](evidence/epic-0004-r5/ac6-og-meta.txt) |

### #80 の確認（ハイドレーション前に選んだファイル）

記録: [ac4-hydration-r5.txt](evidence/epic-0004-r5/ac4-hydration-r5.txt)。どの手順も、読み込み前は `html[data-hydrated="1"]` が無く、一覧は 0 件・「0 / 10 枚」のまま、入力（`input.files`）にだけファイルがある（修正前の不具合の状態）ことを先に記録した。

| 手順 | 読み込みのあと | 結果 |
|---|---|---|
| S1: JS を止めた `/create` で Tab 6 回 → Enter、写真 2 枚（赤・緑）を選び、止めを外す | 一覧 2 枚、「2 / 10 枚」、1 秒後も 2 枚、警告 0。代替テキストを入れて投稿でき、投稿詳細のスライド 2 枚（選んだ順） | PASS |
| S2: Slow 3G（500kbps・遅延 400ms）で読み込みながら、読み込み前に 1 枚選ぶ（読み込みに 3.3 秒） | 一覧 1 枚、「1 / 10 枚」、1 秒後も 1 枚（二重に入らない）。同じ写真をキーボードで選び直すと 2 枚（「2 / 10 枚」）で、増えるのは選び直した 1 回ぶんだけ | PASS |
| S3: 読み込み前に 11 枚選ぶ | 10 枚（「10 / 10 枚」）、「写真は 10 枚までです」 | PASS |
| S4: 読み込み前に 10MB 超の JPEG を選ぶ | 0 枚、「too-large.jpg: ファイルが大きすぎます（1 枚 10MB まで）」 | PASS |
| S5: 同じ仕組みのアイコン選択（`/accounts/edit`）で読み込み前に 1 枚選ぶ | 「新しいアイコンのプレビュー」が 1 つ出る | PASS |

画像選択部品（`ImagePicker`）の確認画面 `/e2e-harness/upload` は本番ビルドでは 404 で、手では開けない（E2E の専用の画面）。同じフック `useFilesPickedBeforeHydration` を使う `/create` と `AvatarField` で確かめた。

### キーボードで届くか

Tab だけで全ての操作に届いた（[summary.json](evidence/epic-0004-r5/summary.json) の `tabOrder`）。`/create`: ナビ → 写真を選ぶ → 比率 → 各写真の切り抜き・代替テキスト・前へ・後ろへ・外す → キャプション → 投稿。`/p/<id>`: ナビ → 作者 → 削除 → 写真 → 前後 → いいね → 「0 件のいいね」 → コメント。削除ダイアログは Enter で開き、Tab はダイアログの中を回る。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0004-r5/summary.json) の `health`）。**コンソールの警告は全体で 0**（#80 の手順を含む）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（A・B）、`/create`（空・入力済み・投稿）、投稿詳細、プロフィールのグリッドとモーダル・新しいタブ、AC-4 の境界、AC-5 の投稿、他人の投稿詳細、いいねの一覧、削除の確認ダイアログと削除、コメントの投稿、**#80 の S1〜S5（JS を止めた読み込み・Slow 3G を含む）** | 0 | 0 |
| 存在しない `/p/<id>`、削除した投稿の `/p/<id>`、削除済みの投稿の通常のページ（想定した 404）。最後の手順（B で削除済みの投稿を開く）の 404 は、記録の区切りの都合で S5 の欄に数えられている | 各 1 件の `Failed to load resource ... 404` | 想定した 404 の応答 |
| 投稿とコメントの削除の通信、写真の送信の通信を止めた手順（わざと `abort`） | 各 1 件の `net::ERR_FAILED` | 止めた POST 1 件ずつ |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（アプリのサーバーを止めて実行、1 回目で通った）。typecheck・lint・format・docs（73 件）・unit（445）・integration（226、4 件は skip）・build・e2e（150 件）・perf-budget が全て OK。記録: [verify.txt](evidence/epic-0004-r5/verify.txt) | 0 |

## 見つけた問題

なし。補足: 試験の走行の自動判定で、コメントの削除ダイアログを Esc で閉じたあとの focus を「削除」の始まりと照合する 1 件が NG と出た。4 回目と同じ照合の書き方の誤りで、記録の文字列が 20 字で切れて「@<利用者> のコ」（ボタンの名前は「@<利用者> のコメントを削除」）になっており、focus はコメントの削除ボタンに戻っている（[ac3-focus-r5.txt](evidence/epic-0004-r5/ac3-focus-r5.txt) の最終行）。製品の不具合ではない。
