---
type: TestReport
title: EPIC #4 投稿（複数の写真の投稿・投稿詳細・グリッドのモーダル・削除）の総合試験（2 回目）
description: 統合ブランチ m1/local-mvp の 2f2e1c4 で、EPIC #4 の 6 つの受け入れ条件を実ブラウザ（Google Chrome 157）でやり直した。#74 の修正で「削除」の警告が消え、全ての画面でコンソールのエラー・警告と失敗した通信が 0（想定した 404 を除く）。結果は PASS。
tags: [epic-test]
---

# EPIC #4 投稿の総合試験（2 回目）

## 対象

- EPIC: [#4](https://github.com/ohta-rh/insta-modoki/issues/4)（子 PBI #27・#33・#28・#41 と、1 回目で見つけた不具合 #74）。1 回目: [epic-0004-post-create-detail.md](epic-0004-post-create-detail.md)（FAIL。「削除」でコンソールに警告 1 件）
- 試験した commit: `2f2e1c4`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`、バケット `insta-s3`、`slot.mjs prepare 3` の空に近い状態）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP のプロファイルは別のセッションが握っているため、[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。データは全て UI から作った（利用者 2 人。パスワードは実行時に生成し、記録していない）。
- 1 回目との違い: 「いいねした人」の一覧を開く手順（B が A の投稿にいいね → A が件数を押して一覧を開く。0 件の投稿の空の状態も）を AC-3 に足し、コンソールの警告 0 を確かめた。
- AC-3 のバケットの一覧は `.dev.vars` の鍵で署名した S3 ListObjectsV2 で取った（鍵は記録していない）。AC-5 の EXIF は `sharp` の `metadata()` で調べた（`exiftool` は使っていない）。
- 項目ごとのデータ: [summary.json](evidence/epic-0004-r2/summary.json)

## 結果

PASS。AC-1〜AC-6 を全て満たした。1 回目の不具合（「削除」でコンソールに警告）は直っていて、「削除」の確認ダイアログと「いいねした人」の一覧のどちらを開いても、コンソールのエラー・警告は 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `/create` で写真 3 枚（赤・緑・青、サイズも形式も別）を選び、1:1 に切り抜き、代替テキスト 3 つとキャプションを入れて投稿。矢印キーで送る。失敗・空の経路: 写真 0 枚の `/create` | PASS。`/p/<uuid>` に移り、バッジ `1/3`、ドット 3 つ、スライド 3 枚。保存された色は選んだ順（赤・緑・青）で全て 640x640、`alt` は選んだとおり、キャプションが出る。ArrowRight で `2/3`（3 幅とも）、→→で `3/3`、←で `2/3`。バケットに新しいファイル 12 個（3 枚 × 4）。空の `/create` は「投稿」が無効 | 空 [1280](evidence/epic-0004-r2/ac1-create-empty-1280.png)・[768](evidence/epic-0004-r2/ac1-create-empty-768.png)・[375](evidence/epic-0004-r2/ac1-create-empty-375.png)、入力済み [1280](evidence/epic-0004-r2/ac1-create-filled-1280.png)・[768](evidence/epic-0004-r2/ac1-create-filled-768.png)・[375](evidence/epic-0004-r2/ac1-create-filled-375.png)、投稿後 [1280](evidence/epic-0004-r2/ac1-post-1of3-1280.png)・[768](evidence/epic-0004-r2/ac1-post-1of3-768.png)・[375](evidence/epic-0004-r2/ac1-post-1of3-375.png)、矢印キー [1280](evidence/epic-0004-r2/ac1-post-2of3-arrowkey-1280.png)・[768](evidence/epic-0004-r2/ac1-post-2of3-arrowkey-768.png)・[375](evidence/epic-0004-r2/ac1-post-2of3-arrowkey-375.png) |
| AC-2 | プロフィールに 10 件の投稿を作り、各幅（高さ 700）で 300px 付近までスクロールして画面内のタイルをクリック。Esc で閉じる。同じ URL を新しいタブで開く。失敗の経路: 存在しない `/p/<id>` | PASS。モーダルで開き URL が `/p/<id>`。Esc でプロフィールの URL に戻り、スクロール位置は同じ。新しいタブでは同じ URL がダイアログ無しの通常のページ。存在しない `/p/<id>` は 404 | スクロール後 [1280](evidence/epic-0004-r2/ac2-profile-scrolled-1280.png)・[768](evidence/epic-0004-r2/ac2-profile-scrolled-768.png)・[375](evidence/epic-0004-r2/ac2-profile-scrolled-375.png)、モーダル [1280](evidence/epic-0004-r2/ac2-modal-open-1280.png)・[768](evidence/epic-0004-r2/ac2-modal-open-768.png)・[375](evidence/epic-0004-r2/ac2-modal-open-375.png)、Esc 後 [1280](evidence/epic-0004-r2/ac2-after-esc-1280.png)・[768](evidence/epic-0004-r2/ac2-after-esc-768.png)・[375](evidence/epic-0004-r2/ac2-after-esc-375.png)、新しいタブ [1280](evidence/epic-0004-r2/ac2-newtab-page-1280.png)・[768](evidence/epic-0004-r2/ac2-newtab-page-768.png)・[375](evidence/epic-0004-r2/ac2-newtab-page-375.png)、404 [1280](evidence/epic-0004-r2/ac2-unknown-post-404-1280.png)・[768](evidence/epic-0004-r2/ac2-unknown-post-404-768.png)・[375](evidence/epic-0004-r2/ac2-unknown-post-404-375.png) |
| AC-3 | 他の利用者（B）で投稿を開く。B がいいねし、A が「1 件のいいね」から一覧を開いて閉じる（0 件の投稿では空の状態）。A で「削除」→確認ダイアログ→「削除」。前後でバケットを一覧。削除後にプロフィールと投稿の URL を開く | PASS。B の画面に「削除」は 0 個、A は 1 個。一覧に B の 1 人、0 件では「まだいいねはありません」。バケットは削除前 48 個 → 後 36 個で、消えたのは 12 個（3 枚 × `orig`・`w320`・`w640`・`w1080`）で、その投稿のファイルは 0 個残る。グリッドから消え、投稿の URL は 404。確認ダイアログも一覧も、開いたときにコンソールの警告は出ない | 他人 [1280](evidence/epic-0004-r2/ac3-other-user-no-delete-1280.png)・[768](evidence/epic-0004-r2/ac3-other-user-no-delete-768.png)・[375](evidence/epic-0004-r2/ac3-other-user-no-delete-375.png)、一覧 [1280](evidence/epic-0004-r2/ac3-likers-dialog-1280.png)・[768](evidence/epic-0004-r2/ac3-likers-dialog-768.png)・[375](evidence/epic-0004-r2/ac3-likers-dialog-375.png)、一覧（0 件）[1280](evidence/epic-0004-r2/ac3-likers-empty-1280.png)・[768](evidence/epic-0004-r2/ac3-likers-empty-768.png)・[375](evidence/epic-0004-r2/ac3-likers-empty-375.png)、確認 [1280](evidence/epic-0004-r2/ac3-confirm-dialog-1280.png)・[768](evidence/epic-0004-r2/ac3-confirm-dialog-768.png)・[375](evidence/epic-0004-r2/ac3-confirm-dialog-375.png)、削除後 [1280](evidence/epic-0004-r2/ac3-after-delete-profile-1280.png)・[768](evidence/epic-0004-r2/ac3-after-delete-profile-768.png)・[375](evidence/epic-0004-r2/ac3-after-delete-profile-375.png)、404 [1280](evidence/epic-0004-r2/ac3-deleted-404-1280.png)・[768](evidence/epic-0004-r2/ac3-deleted-404-768.png)・[375](evidence/epic-0004-r2/ac3-deleted-404-375.png)、[削除前の一覧](evidence/epic-0004-r2/ac3-bucket-before.txt)、[削除後の一覧](evidence/epic-0004-r2/ac3-bucket-after.txt) |
| AC-4 | 10 枚のあとに 11 枚目。10MB 超（10,491,823 バイト）の JPEG。GIF。2,201 字のキャプション。それぞれで送信した通信を数える | PASS。「写真は 10 枚までです」（10 枚のまま）、「too-large.jpg: ファイルが大きすぎます（1 枚 10MB まで）」、「not-allowed.gif: この形式は使えません（JPEG・PNG・WebP・HEIC）」、「キャプションは 2,200 字までです」（「投稿」は無効）。4 つとも通信は 0 件（2 つ目と 3 つ目はファイル名が前に付く。文言は AC のとおり） | 11 枚目 [1280](evidence/epic-0004-r2/ac4-11th-photo-1280.png)・[768](evidence/epic-0004-r2/ac4-11th-photo-768.png)・[375](evidence/epic-0004-r2/ac4-11th-photo-375.png)、10MB 超 [1280](evidence/epic-0004-r2/ac4-too-large-1280.png)・[768](evidence/epic-0004-r2/ac4-too-large-768.png)・[375](evidence/epic-0004-r2/ac4-too-large-375.png)、GIF [1280](evidence/epic-0004-r2/ac4-gif-1280.png)・[768](evidence/epic-0004-r2/ac4-gif-768.png)・[375](evidence/epic-0004-r2/ac4-gif-375.png)、2,201 字 [1280](evidence/epic-0004-r2/ac4-caption-2201-1280.png)・[768](evidence/epic-0004-r2/ac4-caption-2201-768.png)・[375](evidence/epic-0004-r2/ac4-caption-2201-375.png) |
| AC-5 | GPS つきの JPEG（35.66 N・139.75 E）を投稿し、保存された 4 つのファイルをメディアのオリジンから取って `sharp` で EXIF を調べる | PASS。元の写真は GPS の項目 4 つ（タグ 1〜4）を持つ。保存された `orig`・`w320`・`w640`・`w1080` はどれも `metadata().exif` が無く、`Exif`・`GPS` の文字列もバイト列に無い | [元の写真](evidence/epic-0004-r2/ac5-source-exif.txt)、[保存された 4 つ](evidence/epic-0004-r2/ac5-stored-exif.txt)、投稿 [1280](evidence/epic-0004-r2/ac5-post-1280.png)・[768](evidence/epic-0004-r2/ac5-post-768.png)・[375](evidence/epic-0004-r2/ac5-post-375.png) |
| AC-6 | CDP で 400kbps・遅延 400ms・キャッシュ無し、写真の通信を 5 秒止めて投稿詳細を開く。`layout-shift` で CLS を測る。HTML を Cookie 無しで取り `og:*`・`twitter:*` を見る | PASS。写真が届く前の枠は 600x600・524x524・375x375 で、届いたあとも同じ。CLS は 1280: 0、768: 0、375: 0.0076（0.1 以下）。HTML に `og:title`・`og:description`・`og:url`・`og:image`・`og:type`・`twitter:card`・`twitter:title` が入る。エラーと失敗した通信は 0 | 読み込み前 [1280](evidence/epic-0004-r2/ac6-loading-1280.png)・[768](evidence/epic-0004-r2/ac6-loading-768.png)・[375](evidence/epic-0004-r2/ac6-loading-375.png)、読み込み後 [1280](evidence/epic-0004-r2/ac6-loaded-1280.png)・[768](evidence/epic-0004-r2/ac6-loaded-768.png)・[375](evidence/epic-0004-r2/ac6-loaded-375.png)、[OGP のタグ](evidence/epic-0004-r2/ac6-og-meta.txt) |

### キーボードで届くか

Tab だけで全ての操作に届いた（[summary.json](evidence/epic-0004-r2/summary.json) の `tabOrder`）。`/create`（3 枚選択後）: ナビ → 写真を選ぶ → 比率 → 各写真の切り抜き・代替テキスト・前へ・後ろへ・外す → キャプション → 投稿。`/p/<id>`: ナビ → 作者 → 削除 → 写真 → 前の写真 → 次の写真 → いいね → 「0 件のいいね」（一覧） → コメント → 作者 → コメントの入力欄。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0004-r2/summary.json) の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（A・B）、`/create`（空・入力済み・投稿）、投稿詳細（カルーセル・矢印キー・遅い回線）、プロフィールのグリッドとモーダル・新しいタブ、AC-4 の 4 つの入力の境界、AC-5 の投稿、他人の投稿詳細、いいねの一覧（1 人・0 件）、「削除」の確認ダイアログと削除の実行 | 0 | 0 |
| 存在しない `/p/<id>`、削除した投稿の `/p/<id>`（どちらも想定した 404） | 各 1 件の `Failed to load resource ... 404`（404 を試したので想定どおり） | 想定した 404 の応答 1 件ずつ |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（アプリのサーバーを止めて実行。`uptime` の load 5〜6）。typecheck・lint・format・docs・unit（385）・integration（226、4 件は skip）・build・e2e（117 件。子 PBI の `post-create`・`post-detail`・`post-modal`・`media-upload`、#74 の `like` の「件数を押すと一覧のダイアログが 1 度だけ開き コンソールに警告が出ない」を含む）が全て OK。記録: [verify.txt](evidence/epic-0004-r2/verify.txt) | 0 |

## 見つけた問題

なし。1 回目の問題（「削除」でコンソールに警告）は #74 で直り、再現しなかった。AC-4 の 2 つのメッセージの前にファイル名が付くのは 1 回目と同じで、AC の文言を含むので問題としない。
