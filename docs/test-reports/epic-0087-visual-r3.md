---
type: TestReport
title: EPIC #87 見た目の総合試験（3 回目）
description: 統合ブランチ m2/cloudflare-demo の 5066666（#125・#126・#127 を含む）で、EPIC #87 の 11 の受け入れ条件を 375・1024・1280px の実ブラウザ（Google Chrome 158）でやり直した。2 回目の AC-10 の 3 つの原因（おすすめの名前のリンク、公開の投稿の「ログイン」、不正なファイルのエラーの axe）は消え、11 の AC が全て PASS。
tags: [epic-test]
---

# EPIC #87 見た目の総合試験（3 回目）

## 対象

- EPIC: [#87](https://github.com/ohta-rh/insta-modoki/issues/87)。1 回目: [epic-0087-visual.md](epic-0087-visual.md)、2 回目: [epic-0087-visual-r2.md](epic-0087-visual-r2.md)（AC-10 が 3 原因で FAIL）
- 試験した commit: `5066666`（統合ブランチ `m2/cloudflare-demo`。#125・#126・#127 を含む）。`epic-test/87` はその上に 1・2 回目のレポートの commit だけが載る（`25d1461`。docs のみの差）
- 日付: 2026-11-24
- スロット: 4（`http://localhost:3104`、`pnpm build` → `PORT=3104 pnpm start --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s4`。利用者はこの試験で新しく作った。pnpm 12.18.0）
- OS: macOS 26.2
- ブラウザ: Google Chrome 158.0.8127.37（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` の画面ありの Google Chrome を使い捨てのプロファイルで起こして操作した。寸法は `getBoundingClientRect`・`getComputedStyle`、axe は `@axe-core/playwright`（wcag2a・2aa・21a・21aa・22aa）。画面は 1280×800・1024×768・375×812。
- データ: アプリ自身の E2E ハーネスで入れた。利用者 10 人、投稿 36 件（長いキャプション・3 枚・4:5）、自分の投稿 14 件、ストーリー 7 件、通知 3 件（今日・3 日前・40 日前）、長いコメントと返信、フォローの友達の友達（おすすめ）、ログインしていない公開の投稿。投稿の作成と不正なファイルの選択は UI。
- 試験の手順は 2 回目と同じで、AC-10 の 44×44 の測る範囲に `aside a, aside button` を足した（`main a, main button, aside a, aside button, button, [role=button], input, select, textarea, [role=tab], nav a`。1px 以下は除く）。
- 記録: [r3-results.json](evidence/epic-0087-r3/r3-results.json)（測定 438 行、不合格 0）、[r3-a11y.json](evidence/epic-0087-r3/r3-a11y.json)（画面ごとの axe・44px。81 回、測った要素は延べ 4,358（`main a, main button` の数は延べ 4,863。重なる画面の分を重ねて数える）。44px 未満は 0）、[r3-walk.spec.ts.txt](evidence/epic-0087-r3/r3-walk.spec.ts.txt)（手順）、[r3-walk.log](evidence/epic-0087-r3/r3-walk.log)

## 結果

PASS。11 の AC が全て満たされた。2 回目の問題 1〜3 はどれも再現しない。

## 受け入れ条件

測った値は ±1px で参照・各 PBI の決めた値と比べた（実測値は `r3-results.json`）。画像は `evidence/epic-0087-r3/`（`<AC>-<手順>-<幅>.png`、106 枚。名前は 2 回目と同じ）。各行の写真は、1280・1024・375px の 3 枚ずつ（幅を `-1280`・`-1024`・`-375` に替える）。

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | ホームを 3 幅で開く。「その他」を開く。存在しない URL（失敗の経路） | PASS。ナビ 244px（1280）・72px（1024）、375px は下部タブ 50px・上部バー 45px・側のナビなし。今の項目は塗りつぶしの SVG 1 つで線 0px。「その他」はプロフィールを編集・ログアウト。存在しない URL は 404、axe 0 | [home-nav](evidence/epic-0087-r3/AC-1-home-nav-1280.png) / [more-menu](evidence/epic-0087-r3/AC-1-more-menu-1280.png) / [not-found](evidence/epic-0087-r3/AC-1-not-found-1280.png) |
| AC-2 | ホームのカードを測る。空のコメント（失敗の経路） | PASS。14px/18px・黒、罫線 `rgb(219,219,219)`、フィードの列・カード 470px（375px は 375px）、カードの間 20px、名前 600・時刻・その他の操作、いいね数は操作の列の下、最下にコメントの入力。「続きを読む」は 2 行＋446×44px。1280px は右の列 319px・中央から 64px、1024px 以下は出ない。空のコメントは送れない | [home](evidence/epic-0087-r3/AC-2-home-1280.png) [1024](evidence/epic-0087-r3/AC-2-home-1024.png) [375](evidence/epic-0087-r3/AC-2-home-375.png) |
| AC-3 | ストーリーの列、1280px で「次へ」、存在しない人（失敗の経路）、ストーリーの画面 | PASS。輪 66px・アバター 56px・名前 12px・列の下 24px・未読の輪は自前のグラデーション。1280px で scrollLeft が増える。存在しない人は 404 | [tray](evidence/epic-0087-r3/AC-3-tray-1280.png) / [next](evidence/epic-0087-r3/AC-3-tray-next-1280.png) / [viewer](evidence/epic-0087-r3/AC-3-viewer-1280.png) / [404](evidence/epic-0087-r3/AC-3-story-missing-1280.png) |
| AC-4 | 自分と他人のプロフィール、存在しない人（失敗の経路） | PASS。中身 935px（375px は 375px）、ユーザー名 20px/400、数の行 16px・単位 `rgb(115,115,115)`・間 40px、375px は 3 等分で単位は 1 行、タブは SVG、タイル 311×414.66px（3:4）・隙間 1px | [own](evidence/epic-0087-r3/AC-4-own-1280.png) / [other](evidence/epic-0087-r3/AC-4-other-1280.png) / [404](evidence/epic-0087-r3/AC-4-not-found-1280.png) |
| AC-5 | 投稿の画面とモーダル、× で閉じる | PASS。投稿の画面 1280・1024px は写真 480×600px・右の列 335px、375px は 1 列。モーダルは暗い背景・右の列 335px・写真 4:5・× 44×44px で閉じて元のプロフィールに戻る | [page](evidence/epic-0087-r3/AC-5-post-page-1280.png) / [modal](evidence/epic-0087-r3/AC-5-modal-1280.png) |
| AC-6 | 1280・1024px で「検索」「通知」、3 つの閉じ方、直接のリンク、検索の 0 件（失敗・空の経路） | PASS。URL は `/` のまま、ナビ 72px、パネル x=72・幅 397px。Esc・外・同じ項目で閉じる。通知は期間の見出し。`/notifications`・`/explore/search` の直接は今のページ。375px の「通知」はページへ移る。0 件の文言はパネルとページの両方で出る | [search](evidence/epic-0087-r3/AC-6-search-1280.png) / [notif](evidence/epic-0087-r3/AC-6-notif-1280.png) / [0 件](evidence/epic-0087-r3/AC-6-search-empty-1280.png) / [直接](evidence/epic-0087-r3/AC-6-notifications-page-1280.png) |
| AC-7 | 「投稿」で選ぶ・切り取り・キャプション・シェア。画像でないファイル（失敗の経路）。`/create` 直接 | PASS。見ていた画面の上のモーダル（URL `/create`）で 3 段を進めて `/p/<id>` に投稿できた（3 幅）。`x.txt` は「この形式は使えません」で先へ進まず、axe 0（2 回目の違反は消えた）。`/create` 直接は 1 ページのフォーム | [select](evidence/epic-0087-r3/AC-7-step0-select-1280.png) / [crop](evidence/epic-0087-r3/AC-7-step1-crop-1280.png) / [caption](evidence/epic-0087-r3/AC-7-step2-caption-1280.png) / [shared](evidence/epic-0087-r3/AC-7-shared-1280.png) / [bad-file](evidence/epic-0087-r3/AC-7-bad-file-1280.png) / [direct](evidence/epic-0087-r3/AC-7-direct-create-1280.png) |
| AC-8 | ログイン・登録・公開のプロフィールと投稿を、ログインせずに開く。誤ったパスワード・空の送信（失敗の経路） | PASS。ログインは 1280px で左右 2 分・フォーム 536px・入力 60px・角丸 16px・ボタンは丸い端。登録は 1 列 560px。公開ページは 60px の上部バー（ログイン・新しいアカウントを作成）でナビなし。誤りは alert、空の送信は止まる | [login](evidence/epic-0087-r3/AC-8-login-1280.png) / [error](evidence/epic-0087-r3/AC-8-login-error-1280.png) / [signup](evidence/epic-0087-r3/AC-8-signup-1280.png) / [empty](evidence/epic-0087-r3/AC-8-signup-empty-submit-1280.png) / [profile](evidence/epic-0087-r3/AC-8-public-profile-1280.png) / [post](evidence/epic-0087-r3/AC-8-public-post-1280.png) |
| AC-9 | 発見とタグ（空） | PASS。グリッド 935px（375px は 375px）・3 列・3:4。検索の入口は 375px だけ。存在しないタグは空の状態 | [explore](evidence/epic-0087-r3/AC-9-explore-1280.png) / [tag](evidence/epic-0087-r3/AC-9-tag-empty-1280.png) |
| AC-10 | 全ての画面と重ねた画面で axe・44×44px・キーボード・視差効果・コンソール | PASS。下の節 | [focus](evidence/epic-0087-r3/AC-10-focus-ring-1280.png) [1024](evidence/epic-0087-r3/AC-10-focus-ring-1024.png) [375](evidence/epic-0087-r3/AC-10-focus-ring-375.png) |
| AC-11 | ログイン前後の画面を見る | PASS。参照の名前は出ない（`Meta` は非公式の注記だけ）。名前「Mado」、主のボタン `rgb(79,70,200)`、ストーリーの輪は自前のグラデーション、注記は残る。`brand.test.ts` 4 件緑 | [footer](evidence/epic-0087-r3/AC-11-brand-footer-1280.png) / [home](evidence/epic-0087-r3/AC-11-brand-home-1280.png) |

### AC-10: アクセシビリティ（PASS）

画面と重ねた画面 28 種を 3 幅で、axe と「`main a, main button, aside a, aside button` ほか全部が 44×44px 以上」を測った（81 回。ログイン後・ログイン前・不正なファイルの状態を含む）。

| 項目 | 結果 |
|---|---|
| axe の重大・深刻な違反 | PASS。81 回で 0 件。2 回目に出た不正なファイルのエラー（`listitem`・`color-contrast`）は 3 幅とも 0（#126） |
| 操作できる要素は 44×44px 以上 | PASS。81 回で 44px 未満は 0 個。1280px のホーム（測った要素 154、うち `main a, main button` 183）のおすすめの列の名前のリンクは全て 44px 以上（#127）。公開の投稿の「ログイン」は 3 幅とも 44×44 以上（#125）。不正なファイルの状態（1280px で 155 要素）も 0 個 |
| キーボード | PASS。1280・1024px は Tab でナビの全項目、375px は Shift+Tab で下部タブの全項目に届く。フォーカスの輪郭は 3 幅で Tab 60 回＋Shift+Tab 14 回とも 2px 以上 |
| 視差効果を減らす | PASS。3 幅のホーム・「その他」・作成のモーダル・投稿のモーダルと、1280・1024px の検索・通知のパネルで、動きのある要素は 0 |
| コンソール・ネットワーク | PASS（下の節） |
| 回帰 | 3 つの E2E（`a11y.spec.ts`・`keyboard.spec.ts`・`reduced-motion.spec.ts`）は、この試験の指示（verify・E2E の全部は流さない）により実行していない。同じ検査を実ブラウザの手順で行った |

## ブラウザの状態

| 画面 | コンソールのエラー・警告 | 失敗した通信 |
|---|---|---|
| ログイン後の正常な操作（3 幅。延べ 97 回の移動） | 0 | `/api/notifications/stream` の `net::ERR_ABORTED` が各幅で 1 種類（移動で通知の配信を閉じた分。HTTP の失敗ではない）。HTTP 400 以上は 0 |
| ログイン後の失敗の経路（存在しない URL・ストーリー・プロフィール・タグ） | 起こした 404 の 4 件のみ（各幅） | 同上。HTTP は起こした 404 の 4 件のみ |
| キーボード・視差効果を減らす設定 | 0 | 配信の `ERR_ABORTED` のみ |
| ログイン前の画面（ログイン・登録・公開・誤り・空の送信） | 0 | 0 |
| ブランドの確認（ログイン後のホーム） | 0 | 0 |

## 回帰

| 確認 | コマンド | 終了コード |
|---|---|---|
| 試験の手順（6 件、測定 438 行で不合格 0） | `PORT=3104 npx playwright test -c .tmp_epic87r3/r3.config.ts` | rc=0（6 passed） |
| ビルド | `pnpm build` | rc=0 |
| `brand.test.ts` | 2 回目の確認（`npx vitest run src/shared/ui/brand.test.ts`、4 件緑）。今回の指示では流していない | 実施せず |
| 子 PBI の E2E・`node scripts/verify.mjs`・E2E の全部 | この試験の指示で流さない | 実施せず |

## 見つけた問題

なし。

注記（問題ではない）: AC-2 のキャプションの `p` は先頭行の名前のリンク 44px＋18px で、見た目は 2 行。AC-5 のモーダルの写真は #94 の決めた値（1280px で 576×720px）。終了時にスロット 4 のアプリを止め、`lsof -ti tcp:3104` が空であることを確かめた（`slot.mjs reset`・`drop` は指示により実行していない）。
