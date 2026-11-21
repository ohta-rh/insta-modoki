---
type: TestReport
title: EPIC #4 投稿（複数の写真の投稿・投稿詳細・グリッドのモーダル・削除）の総合試験（1 回目）
description: 統合ブランチ m1/local-mvp の ddda5d8 で、EPIC #4 の 6 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。機能は 6 つとも満たしたが、投稿詳細の「削除」を押すとコンソールに警告が 1 件出るため、ブラウザの状態の基準（警告 0）で FAIL。
tags: [epic-test]
---

# EPIC #4 投稿の総合試験（1 回目）

## 対象

- EPIC: [#4](https://github.com/ohta-rh/insta-modoki/issues/4)（子 PBI #27 アップロード・#33 投稿の作成・#28 投稿詳細・#41 グリッドのモーダル）
- 試験した commit: `ddda5d8`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-21
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`、バケット `insta-s3`、空のスロットから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。データは全て UI から作った（利用者 2 人。パスワードは実行時に生成し、どこにも書いていない）。
- 写真は `sharp` で作った本物のファイル（赤 1600x1200 JPEG・緑 900x1200 JPEG・青 1000x1000 PNG など）。バケットの一覧は `.dev.vars` の鍵で署名した S3 ListObjectsV2 で取った（鍵は記録していない。記録したのはオブジェクトのキーと数だけ）。
- 項目ごとのデータ: [summary.json](evidence/epic-0004/summary.json)

## 結果

FAIL。AC-1〜AC-6 の中身（操作と結果）は全て満たした。しかし投稿詳細の「削除」を押すと、実 Chrome のコンソールに警告が 1 件出る（コンソールのエラー・警告は 0 という基準を満たさない）。製品の不具合として 1 件（下の「見つけた問題」）。AC-6 の文はコンソールの「エラー」と失敗した通信が 0 であり、エラーと失敗した通信は 0 だったが、試験の基準（警告も 0）に従い AC-6 は FAIL とした。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | ログイン済みで `/create` を開き、写真 3 枚（赤・緑・青、サイズも形式も別）を選び、1:1 に切り抜き、代替テキスト 3 つとキャプションを入れて投稿。矢印キーで送る。失敗・空の経路として、写真が 0 枚の `/create` | PASS。`/p/<uuid>` に移り、カルーセルは 3 枚。バッジ `1/3`、ドット 3 つ。保存された 3 枚の色は選んだ順（赤・緑・青）で、どれも 640x640（1:1）、`alt` は「赤い写真」「緑の写真」「青い写真」、キャプションが出る。カルーセルにフォーカスして ArrowRight で `2/3`（3 幅とも）、→→で `3/3`、←で `2/3`。バケットに新しいファイルが 12 個（3 枚 × 4）。空の `/create` は「投稿」が無効で理由が出る | [空の `/create` 1280](evidence/epic-0004/ac1-create-empty-1280.png)・[768](evidence/epic-0004/ac1-create-empty-768.png)・[375](evidence/epic-0004/ac1-create-empty-375.png)、[入力済み 1280](evidence/epic-0004/ac1-create-filled-1280.png)・[768](evidence/epic-0004/ac1-create-filled-768.png)・[375](evidence/epic-0004/ac1-create-filled-375.png)、[投稿後 1/3 1280](evidence/epic-0004/ac1-post-1of3-1280.png)・[768](evidence/epic-0004/ac1-post-1of3-768.png)・[375](evidence/epic-0004/ac1-post-1of3-375.png)、[矢印キーで 2/3 1280](evidence/epic-0004/ac1-post-2of3-arrowkey-1280.png)・[768](evidence/epic-0004/ac1-post-2of3-arrowkey-768.png)・[375](evidence/epic-0004/ac1-post-2of3-arrowkey-375.png) |
| AC-2 | 作者のプロフィールに 10 件の投稿を作り、各幅（高さ 700）で 300px 付近までスクロールして画面内のタイルをクリック。Esc で閉じる。同じ URL を新しいタブで開く。失敗の経路として存在しない `/p/<id>` | PASS。モーダルで開き URL が `/p/<id>`（背面のプロフィールは残る）。Esc で閉じるとプロフィールの URL に戻り、スクロール位置はクリック前と同じ（1280: 300、768: 288.5、375: 131.5）。新しいタブでは同じ URL がダイアログ無しの通常のページ。存在しない `/p/<id>` は 404 | [スクロール後 1280](evidence/epic-0004/ac2-profile-scrolled-1280.png)・[768](evidence/epic-0004/ac2-profile-scrolled-768.png)・[375](evidence/epic-0004/ac2-profile-scrolled-375.png)、[モーダル 1280](evidence/epic-0004/ac2-modal-open-1280.png)・[768](evidence/epic-0004/ac2-modal-open-768.png)・[375](evidence/epic-0004/ac2-modal-open-375.png)、[Esc 後 1280](evidence/epic-0004/ac2-after-esc-1280.png)・[768](evidence/epic-0004/ac2-after-esc-768.png)・[375](evidence/epic-0004/ac2-after-esc-375.png)、[新しいタブ 1280](evidence/epic-0004/ac2-newtab-page-1280.png)・[768](evidence/epic-0004/ac2-newtab-page-768.png)・[375](evidence/epic-0004/ac2-newtab-page-375.png)、[404 1280](evidence/epic-0004/ac2-unknown-post-404-1280.png)・[768](evidence/epic-0004/ac2-unknown-post-404-768.png)・[375](evidence/epic-0004/ac2-unknown-post-404-375.png) |
| AC-3 | 他の利用者（B）で AC-1 の投稿を開く。作者（A）で「削除」→確認ダイアログ→「削除」。削除の前後でバケットを一覧する。削除後にプロフィールと投稿の URL を開く | PASS。B の画面に「削除」は 0 個、A の画面は 1 個。バケットは削除前 84 個 → 後 72 個で、消えたのは 12 個（3 枚 × `orig`・`w320`・`w640`・`w1080`）。AC-1 のときに増えた 12 個と一致し、その投稿のファイルは 0 個残っている。作者のグリッドから消え、投稿の URL は 404 | [他人 1280](evidence/epic-0004/ac3-other-user-no-delete-1280.png)・[768](evidence/epic-0004/ac3-other-user-no-delete-768.png)・[375](evidence/epic-0004/ac3-other-user-no-delete-375.png)、[確認 1280](evidence/epic-0004/ac3-confirm-dialog-1280.png)・[768](evidence/epic-0004/ac3-confirm-dialog-768.png)・[375](evidence/epic-0004/ac3-confirm-dialog-375.png)、[削除後のプロフィール 1280](evidence/epic-0004/ac3-after-delete-profile-1280.png)・[768](evidence/epic-0004/ac3-after-delete-profile-768.png)・[375](evidence/epic-0004/ac3-after-delete-profile-375.png)、[404 1280](evidence/epic-0004/ac3-deleted-404-1280.png)・[768](evidence/epic-0004/ac3-deleted-404-768.png)・[375](evidence/epic-0004/ac3-deleted-404-375.png)、[削除前の一覧](evidence/epic-0004/ac3-bucket-before.txt)、[削除後の一覧](evidence/epic-0004/ac3-bucket-after.txt) |
| AC-4 | 10 枚のあとに 11 枚目を選ぶ。10MB 超（10,491,823 バイト）の JPEG を選ぶ。GIF を選ぶ。2,201 字のキャプションを入れる。それぞれで送信した通信を数える | PASS。「写真は 10 枚までです」（10 枚のまま）、「too-large.jpg: ファイルが大きすぎます（1 枚 10MB まで）」、「not-allowed.gif: この形式は使えません（JPEG・PNG・WebP・HEIC）」（どちらも 0 枚）、「キャプションは 2,200 字までです」（カウンタ `2,201 / 2,200`、「投稿」は無効）。4 つとも選択してからの通信は 0 件。注: 2 つ目と 3 つ目の文言の前にファイル名が付く（文言そのものは AC のとおり） | [11 枚目 1280](evidence/epic-0004/ac4-11th-photo-1280.png)・[768](evidence/epic-0004/ac4-11th-photo-768.png)・[375](evidence/epic-0004/ac4-11th-photo-375.png)、[10MB 超 1280](evidence/epic-0004/ac4-too-large-1280.png)・[768](evidence/epic-0004/ac4-too-large-768.png)・[375](evidence/epic-0004/ac4-too-large-375.png)、[GIF 1280](evidence/epic-0004/ac4-gif-1280.png)・[768](evidence/epic-0004/ac4-gif-768.png)・[375](evidence/epic-0004/ac4-gif-375.png)、[2,201 字 1280](evidence/epic-0004/ac4-caption-2201-1280.png)・[768](evidence/epic-0004/ac4-caption-2201-768.png)・[375](evidence/epic-0004/ac4-caption-2201-375.png) |
| AC-5 | GPS つきの JPEG（`sharp` の `withExifMerge` で作る。35.66 N・139.75 E）を投稿し、保存された 4 つのファイルをメディアのオリジンから取って EXIF を調べる（Director が認めた方法。`exiftool` は使わない） | PASS。元の写真は `sharp(...).metadata().exif` があり、IFD0 に GPS への参照（0x8825）、GPS の項目 4 つ（タグ 1〜4）がある。保存された `orig`・`w320`・`w640`・`w1080` の 4 つは、どれも `metadata().exif` が無く、`Exif`・`GPS` の文字列もバイト列に無い | [元の写真の EXIF](evidence/epic-0004/ac5-source-exif.txt)、[保存された 4 つ](evidence/epic-0004/ac5-stored-exif.txt)、[投稿 1280](evidence/epic-0004/ac5-post-1280.png)・[768](evidence/epic-0004/ac5-post-768.png)・[375](evidence/epic-0004/ac5-post-375.png) |
| AC-6 | CDP で 400kbps・遅延 400ms・キャッシュ無しにし、写真の通信をさらに 5 秒止めて投稿詳細を開く。`PerformanceObserver('layout-shift')` で CLS を測る。HTML を Cookie 無しで取り、`og:*`・`twitter:*` を見る。3 幅の写真。コンソールと通信 | 画面は PASS。写真が 1 枚も届く前の枠は 600x600・524x524・375x375 で、届いたあとも同じ。CLS は 1280: 0、768: 0、375: 0.0094（0.1 以下）。HTML に `og:title`・`og:description`・`og:url`・`og:image`（と幅・高さ）・`og:type`・`twitter:card`・`twitter:title`・`twitter:description`・`twitter:image` が入る。3 幅とも崩れない。エラーと失敗した通信は 0。ただし「削除」を押すと警告が 1 件（下の「見つけた問題」）。このため試験の基準では FAIL | [読み込み前 1280](evidence/epic-0004/ac6-loading-1280.png)・[768](evidence/epic-0004/ac6-loading-768.png)・[375](evidence/epic-0004/ac6-loading-375.png)、[読み込み後 1280](evidence/epic-0004/ac6-loaded-1280.png)・[768](evidence/epic-0004/ac6-loaded-768.png)・[375](evidence/epic-0004/ac6-loaded-375.png)、[OGP のタグ](evidence/epic-0004/ac6-og-meta.txt) |

### キーボードで届くか

Tab だけで、1 巡目に次の順で全ての操作に届いた（[summary.json](evidence/epic-0004/summary.json) の `tabOrder`。末尾は 1 周して先頭に戻る）。

- `/create`（3 枚を選んだ状態）: ホーム → 検索 → 投稿 → 通知 → プロフィール（左のナビ）→ 写真を選ぶ → 比率（ラジオ）→ 写真 1 の切り抜き → 代替テキスト → 前へ → 後ろへ → 外す → 写真 2 … 写真 3（同じ並び）→ キャプション → 投稿 → 先頭へ。
- `/p/<id>`: ナビ → 作者 → 削除 → 写真（カルーセル）→ 前の写真 → 次の写真 → いいね → いいねの一覧 → コメント → 作者 → コメントの入力欄 → 先頭へ。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0004/summary.json) の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（A・B）、`/create`（空・入力済み・投稿）、投稿詳細（カルーセル・矢印キー・遅い回線）、プロフィールのグリッドとモーダル・新しいタブ、AC-4 の 4 つの入力の境界、AC-5 の投稿、他人の投稿詳細 | 0 | 0 |
| 投稿詳細で「削除」を押す（AC-3 の削除） | 警告 1 件: `A command attempted to open an already open Dialog as a modal` | 0 |
| 存在しない `/p/<id>`（想定した 404）、削除した投稿の `/p/<id>`（想定した 404） | 各 1 件の `Failed to load resource ... 404`（404 を試したので想定どおり。製品の問題ではない） | 想定した 404 の応答 1 件ずつ |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（アプリのサーバーを止めて実行。`uptime` の load は 5〜10）。1 回目 [verify-run1-flake.txt](evidence/epic-0004/verify-run1-flake.txt): e2e が 104 件通って 1 件落ち（`e2e/post-modal.spec.ts` › 「フォーカスがモーダルの外に出ない」、「Tab 1 回目」で期待 true・実際 false）、2 件が未実行 | 1 |
| 上の 1 件だけを 3 回続けて実行（`pnpm e2e e2e/post-modal.spec.ts -g "フォーカスがモーダルの外"`） | 0, 0, 0 |
| 同じ verify の 2 回目 [verify.txt](evidence/epic-0004/verify.txt): typecheck・lint・format・docs・unit（367）・integration（209）・build・e2e（107 件。子 PBI の `post-create`・`post-detail`・`post-modal`・`media-upload` を含む）が全て OK | 0 |

1 回目の失敗は、他のエージェントがスロット 1・2・4 で同時に動かしていた負荷の高い時間帯（load 8〜10）で、再現しなかった。製品の問題とは判断せず、不安定なテストの疑いとして記録する（根本原因は未確認の仮説）。

## 見つけた問題

1. 投稿詳細の「削除」を押すとコンソールに警告が出る（コンソールの警告 0 に反する）。
   - 再現: ログインして自分の投稿の `/p/<id>` を開き、「削除」を押す（Chrome 157、2 回の実行で毎回）。
   - 期待: 確認ダイアログが開き、コンソールの警告は 0。
   - 実際: ダイアログは開くが、`A command attempted to open an already open Dialog as a modal` の警告が 1 件出る。
   - 疑われる原因（仮説。コードは読んだが挙動は確かめていない）: `src/features/post/ui/DeletePostButton.tsx` が、ボタンに `commandfor`・`command="show-modal"` を付けつつ、`onClick` でも `showModal()` を呼ぶ。クリックで `onClick` が先に開き、そのあとボタンのコマンドが開いたダイアログをもう一度開こうとする。
   - 画面: [確認ダイアログ 1280](evidence/epic-0004/ac3-confirm-dialog-1280.png)。
2. （製品の不具合ではない）AC-4 の 2 つのメッセージの前にファイル名（`too-large.jpg: `・`not-allowed.gif: `）が付く。AC の文言そのものは含まれているので PASS とした。
