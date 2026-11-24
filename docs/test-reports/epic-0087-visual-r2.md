---
type: TestReport
title: EPIC #87 見た目の総合試験（2 回目）
description: 統合ブランチ m2/cloudflare-demo の 916efbc で、EPIC #87 の 11 の受け入れ条件を 375・1024・1280px の実ブラウザ（Google Chrome 158）でやり直した。#122・#124 の「続きを読む」と名前のリンクは直り、1 回目の違反は消えた。AC-10 は別の 3 つの原因（おすすめの列の名前のリンクの高さ、公開の投稿の「ログイン」のリンクの高さ、不正なファイルのエラーの axe）で FAIL。他の 10 の AC は PASS。
tags: [epic-test]
---

# EPIC #87 見た目の総合試験（2 回目）

## 対象

- EPIC: [#87](https://github.com/ohta-rh/insta-modoki/issues/87)。1 回目: [epic-0087-visual.md](epic-0087-visual.md)（AC-10 が「続きを読む」の高さ 18px で FAIL）
- 試験した commit: `916efbc`（統合ブランチ `m2/cloudflare-demo`。#122・#124 を含む。`epic-test/87` はその上に 1 回目のレポートの commit `9bc942a` だけが載る。docs のみの差）
- 日付: 2026-11-24
- スロット: 1（`http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s1`、空の D1 から。終了時に `node scripts/slot.mjs drop 1`）
- OS: macOS 26.2
- ブラウザ: Google Chrome 158.0.8127.37（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` の画面ありの Google Chrome を使い捨てのプロファイルで起こして操作した。寸法は `getBoundingClientRect`・`getComputedStyle`、axe は `@axe-core/playwright`（wcag2a・2aa・21a・21aa・22aa）で測り、画面は 1280×800・1024×768・375×812 で撮った。
- データ: 利用者 10 人、投稿 36 件（長いキャプション・3 枚・4:5 を含む。「続きを読む」が出る）、自分の投稿 14 件、ストーリー 7 件（画像ファイルつき）、通知 3 件（今日・3 日前・40 日前）、長いコメント（2 行を超える）と返信を 3 つの投稿に。アプリ自身の E2E ハーネスで入れた。投稿の作成は UI。
- 記録: [r2-results.json](evidence/epic-0087-r2/r2-results.json)（測定 438 行）、[r2-a11y.json](evidence/epic-0087-r2/r2-a11y.json)（画面ごとの axe・44px。81 回、測った要素は延べ 4,283）、[r2-walk.spec.ts.txt](evidence/epic-0087-r2/r2-walk.spec.ts.txt)（試験の手順）、[r2-walk.log](evidence/epic-0087-r2/r2-walk.log)、[regression-playwright.log](evidence/epic-0087-r2/regression-playwright.log)

## 結果

FAIL。AC-1〜AC-9・AC-11 は満たした。AC-10 は 3 つの原因で満たさない。1 回目の原因（「続きを読む」の高さ 18px、名前のリンク）は直っていて、ホームの `main a, main button` 183 個のうち、44px 未満は 1280px のおすすめの列の 1 個だけ。

## 受け入れ条件

測った値は ±1px で参照・各 PBI の決めた値と比べた（実測値は `r2-results.json`）。画像は `evidence/epic-0087-r2/`（`<AC>-<手順>-<幅>.png`、106 枚）。

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | ホームを 3 幅で開く。「その他」を開く。存在しない URL（失敗の経路） | PASS。ナビ 244px（1280）・72px（1024、下部タブなし）。375px は下部タブ 50px・上部バー 45px・側のナビなし。今の項目は塗りつぶしの SVG 1 つで線 0px。「その他」はプロフィールを編集・ログアウト。存在しない URL は 404 の画面。axe 違反 0（メニュー・404） | [1280](evidence/epic-0087-r2/AC-1-home-nav-1280.png) [1024](evidence/epic-0087-r2/AC-1-home-nav-1024.png) [375](evidence/epic-0087-r2/AC-1-home-nav-375.png) / メニュー [1280](evidence/epic-0087-r2/AC-1-more-menu-1280.png) [1024](evidence/epic-0087-r2/AC-1-more-menu-1024.png) [375](evidence/epic-0087-r2/AC-1-more-menu-375.png) / 404 [1280](evidence/epic-0087-r2/AC-1-not-found-1280.png) [1024](evidence/epic-0087-r2/AC-1-not-found-1024.png) [375](evidence/epic-0087-r2/AC-1-not-found-375.png) |
| AC-2 | ホームのカードを測る。空のコメント（失敗の経路） | PASS。キャプション 14px/18px・`rgb(0,0,0)`、罫線 `rgb(219,219,219)`、フィードの列・カード 470px（375px は 375px）、カードの間 20px、名前 600・時刻・その他の操作、いいね数（y=712）は操作の列の下端（712）、その下にキャプション（y=743）、最下にコメントの入力（y=774）。長いキャプションは 2 行＋「続きを読む」（446×44px）。1280px は右の列 319px・ストーリーの列の右端から 64px、1024px 以下は出ない。空のコメントは送れない。注: 先頭の名前のリンクが 44px の高さなので、キャプションの `p` は 62px（44＋18）で、見た目は 2 行（クランプ 2） | [1280](evidence/epic-0087-r2/AC-2-home-1280.png) [1024](evidence/epic-0087-r2/AC-2-home-1024.png) [375](evidence/epic-0087-r2/AC-2-home-375.png) |
| AC-3 | ストーリーの列を測り、1280px で「次へ」。存在しない人のストーリー（失敗の経路）。ストーリーの画面 | PASS。輪 66px・アバター 56px・名前 12px・列の下 24px（±4）・未読の輪は `linear-gradient(120deg, #0BB8A9, #2B6CF6 62%, #4F46C8)`。1280px で scrollLeft が増える。存在しない人は 404。ストーリーの画面は axe 0・44px 未満 0 | [1280](evidence/epic-0087-r2/AC-3-tray-1280.png) [1024](evidence/epic-0087-r2/AC-3-tray-1024.png) [375](evidence/epic-0087-r2/AC-3-tray-375.png) / 送った後 [1280](evidence/epic-0087-r2/AC-3-tray-next-1280.png) / 画面 [1280](evidence/epic-0087-r2/AC-3-viewer-1280.png) [1024](evidence/epic-0087-r2/AC-3-viewer-1024.png) [375](evidence/epic-0087-r2/AC-3-viewer-375.png) / 404 [1280](evidence/epic-0087-r2/AC-3-story-missing-1280.png) [1024](evidence/epic-0087-r2/AC-3-story-missing-1024.png) [375](evidence/epic-0087-r2/AC-3-story-missing-375.png) |
| AC-4 | 自分と他人のプロフィールを測る。存在しない人（失敗の経路） | PASS。中身 935px（375px は 375px）、ユーザー名 20px/400、数の行 16px・単位 `rgb(115,115,115)`・間 40px、375px は 3 等分（単位は 1 行）、タブは SVG、タイル 311×414.66px（3:4）・隙間 1px（375px は 124.33px）。axe 0・44px 未満 0 | 自分 [1280](evidence/epic-0087-r2/AC-4-own-1280.png) [1024](evidence/epic-0087-r2/AC-4-own-1024.png) [375](evidence/epic-0087-r2/AC-4-own-375.png) / 他人 [1280](evidence/epic-0087-r2/AC-4-other-1280.png) [1024](evidence/epic-0087-r2/AC-4-other-1024.png) [375](evidence/epic-0087-r2/AC-4-other-375.png) / 404 [1280](evidence/epic-0087-r2/AC-4-not-found-1280.png) [1024](evidence/epic-0087-r2/AC-4-not-found-1024.png) [375](evidence/epic-0087-r2/AC-4-not-found-375.png) |
| AC-5 | 投稿の画面とモーダルを測り、× で閉じる | PASS。投稿の画面 1280・1024px は写真 480×600px（4:5）・右の列 335px（コメントの名前のリンク 11 本が画面にあり 44px 未満 0）、375px は 1 列。モーダルは暗い背景 `oklab(0 0 0 / 0.65)`・右の列 335px・写真は 4:5（1280px は 576×720px、#94 の決めた値）・× は 44×44px で閉じて元のプロフィールに戻る。375px は全画面で白 | 画面 [1280](evidence/epic-0087-r2/AC-5-post-page-1280.png) [1024](evidence/epic-0087-r2/AC-5-post-page-1024.png) [375](evidence/epic-0087-r2/AC-5-post-page-375.png) / モーダル [1280](evidence/epic-0087-r2/AC-5-modal-1280.png) [1024](evidence/epic-0087-r2/AC-5-modal-1024.png) [375](evidence/epic-0087-r2/AC-5-modal-375.png) |
| AC-6 | 1280・1024px で「検索」「通知」を押し、Esc・外・同じ項目で閉じる。直接のリンク。**検索の 0 件**（1 回目に撮れなかった画面） | PASS。URL は `/` のまま、ナビ 72px、パネル x=72・幅 397px。3 つの閉じ方で閉じ、Esc の後ナビは 244px（1280px）。通知は「今日」「今週」「それ以前」の見出し。`/notifications`・`/explore/search` の直接は今のページ。375px の「通知」は `/notifications` へ移る。**検索の 0 件**は「「…」に一致するユーザーはいません」を、パネル（1280・1024px）と `/explore/search`（3 幅）で撮った | 検索 [1280](evidence/epic-0087-r2/AC-6-search-1280.png) [1024](evidence/epic-0087-r2/AC-6-search-1024.png) / 通知 [1280](evidence/epic-0087-r2/AC-6-notif-1280.png) [1024](evidence/epic-0087-r2/AC-6-notif-1024.png) / **0 件（ページ）** [1280](evidence/epic-0087-r2/AC-6-search-empty-1280.png) [1024](evidence/epic-0087-r2/AC-6-search-empty-1024.png) [375](evidence/epic-0087-r2/AC-6-search-empty-375.png) / 0 件（パネル）[1280](evidence/epic-0087-r2/AC-6-search-empty-panel-1280.png) [1024](evidence/epic-0087-r2/AC-6-search-empty-panel-1024.png) / 結果 [1280](evidence/epic-0087-r2/AC-6-search-result-1280.png) [1024](evidence/epic-0087-r2/AC-6-search-result-1024.png) [375](evidence/epic-0087-r2/AC-6-search-result-375.png) / 直接 通知 [1280](evidence/epic-0087-r2/AC-6-notifications-page-1280.png) [1024](evidence/epic-0087-r2/AC-6-notifications-page-1024.png) [375](evidence/epic-0087-r2/AC-6-notifications-page-375.png) 検索 [1280](evidence/epic-0087-r2/AC-6-search-page-1280.png) [1024](evidence/epic-0087-r2/AC-6-search-page-1024.png) [375](evidence/epic-0087-r2/AC-6-search-page-375.png) |
| AC-7 | 「投稿」で写真を選び、切り取り、キャプション、シェア。画像でないファイル（失敗の経路）。`/create` 直接 | PASS（AC-7 の動作）。見ていたホームの上のモーダル（URL `/create`、背後に main）で 3 段を進めて `/p/<id>` に投稿できた（3 幅）。`x.txt` は「この形式は使えません（JPEG・PNG・WebP・HEIC）」で先へ進まない。`/create` 直接は 1 ページのフォーム。**ただし不正なファイルの画面に axe の違反がある（AC-10、問題 3）** | 選ぶ [1280](evidence/epic-0087-r2/AC-7-step0-select-1280.png) [1024](evidence/epic-0087-r2/AC-7-step0-select-1024.png) [375](evidence/epic-0087-r2/AC-7-step0-select-375.png) / 切り取り [1280](evidence/epic-0087-r2/AC-7-step1-crop-1280.png) [1024](evidence/epic-0087-r2/AC-7-step1-crop-1024.png) [375](evidence/epic-0087-r2/AC-7-step1-crop-375.png) / キャプション [1280](evidence/epic-0087-r2/AC-7-step2-caption-1280.png) [1024](evidence/epic-0087-r2/AC-7-step2-caption-1024.png) [375](evidence/epic-0087-r2/AC-7-step2-caption-375.png) / 投稿後 [1280](evidence/epic-0087-r2/AC-7-shared-1280.png) [1024](evidence/epic-0087-r2/AC-7-shared-1024.png) [375](evidence/epic-0087-r2/AC-7-shared-375.png) / 失敗 [1280](evidence/epic-0087-r2/AC-7-bad-file-1280.png) [1024](evidence/epic-0087-r2/AC-7-bad-file-1024.png) [375](evidence/epic-0087-r2/AC-7-bad-file-375.png) / 直接 [1280](evidence/epic-0087-r2/AC-7-direct-create-1280.png) [1024](evidence/epic-0087-r2/AC-7-direct-create-1024.png) [375](evidence/epic-0087-r2/AC-7-direct-create-375.png) |
| AC-8 | ログイン・登録・公開のプロフィールと投稿を、ログインせずに開く。誤ったパスワード・空の送信（失敗の経路） | PASS。ログインは 1280px で左右 2 分・フォーム 536px・入力 60px・角丸 16px・ボタン 22px、登録は 1 列 560px（hero なし）、ナビなし。公開のプロフィールと投稿は 60px の上部バー（Mado・ログイン・新しいアカウントを作成）が 3 幅とも出てナビは 0。誤ったパスワードは alert、空の登録は止まる | ログイン [1280](evidence/epic-0087-r2/AC-8-login-1280.png) [1024](evidence/epic-0087-r2/AC-8-login-1024.png) [375](evidence/epic-0087-r2/AC-8-login-375.png) / 誤り [1280](evidence/epic-0087-r2/AC-8-login-error-1280.png) [1024](evidence/epic-0087-r2/AC-8-login-error-1024.png) [375](evidence/epic-0087-r2/AC-8-login-error-375.png) / 登録 [1280](evidence/epic-0087-r2/AC-8-signup-1280.png) [1024](evidence/epic-0087-r2/AC-8-signup-1024.png) [375](evidence/epic-0087-r2/AC-8-signup-375.png) / 空 [1280](evidence/epic-0087-r2/AC-8-signup-empty-submit-1280.png) [1024](evidence/epic-0087-r2/AC-8-signup-empty-submit-1024.png) [375](evidence/epic-0087-r2/AC-8-signup-empty-submit-375.png) / 公開 [1280](evidence/epic-0087-r2/AC-8-public-profile-1280.png) [1024](evidence/epic-0087-r2/AC-8-public-profile-1024.png) [375](evidence/epic-0087-r2/AC-8-public-profile-375.png) [1280](evidence/epic-0087-r2/AC-8-public-post-1280.png) [1024](evidence/epic-0087-r2/AC-8-public-post-1024.png) [375](evidence/epic-0087-r2/AC-8-public-post-375.png) |
| AC-9 | 発見とタグ（空）を測る | PASS。グリッド 935px（375px は 375px）・先頭 3 つが同じ行（y=16,16,16、4 つ目は 432）・タイル 414.66px（3:4）。検索の入口は 375px だけ。存在しないタグは空の状態の画面 | [1280](evidence/epic-0087-r2/AC-9-explore-1280.png) [1024](evidence/epic-0087-r2/AC-9-explore-1024.png) [375](evidence/epic-0087-r2/AC-9-explore-375.png) / タグ [1280](evidence/epic-0087-r2/AC-9-tag-empty-1280.png) [1024](evidence/epic-0087-r2/AC-9-tag-empty-1024.png) [375](evidence/epic-0087-r2/AC-9-tag-empty-375.png) |
| AC-10 | 全ての画面と重ねた画面で axe・44×44px・キーボード・視差効果・コンソール | **FAIL**。下の節（axe は不正なファイルの画面に 2 件、44px 未満はおすすめの列の名前のリンクと公開の投稿の「ログイン」）。キーボード・フォーカスの輪郭・視差効果・コンソールは PASS | フォーカス [1280](evidence/epic-0087-r2/AC-10-focus-ring-1280.png) [1024](evidence/epic-0087-r2/AC-10-focus-ring-1024.png) [375](evidence/epic-0087-r2/AC-10-focus-ring-375.png) |
| AC-11 | ログイン前後の画面を見る | PASS。参照の名前は出ない（`Meta` は非公式の注記だけ）。名前「Mado（仮称）」、ログインのボタン `rgb(79,70,200)`（#4F46C8）、ストーリーの輪は自前のグラデーション。注記は残る。`brand.test.ts` 4 件緑 | 公開 [1280](evidence/epic-0087-r2/AC-11-brand-footer-1280.png) [1024](evidence/epic-0087-r2/AC-11-brand-footer-1024.png) [375](evidence/epic-0087-r2/AC-11-brand-footer-375.png) / ログイン後 [1280](evidence/epic-0087-r2/AC-11-brand-home-1280.png) [1024](evidence/epic-0087-r2/AC-11-brand-home-1024.png) [375](evidence/epic-0087-r2/AC-11-brand-home-375.png) |

### AC-10: アクセシビリティ（FAIL）

画面と重ねた画面の 28 種を 3 幅で、axe と「`main a, main button, button, [role=button], input, select, textarea, [role=tab], nav a`（`a11y.spec.ts` と同じ選び方。1px 以下は除く）の全部が 44×44px 以上」を測った（[r2-a11y.json](evidence/epic-0087-r2/r2-a11y.json)）。

| 項目 | 結果 |
|---|---|
| axe の重大・深刻な違反 | **FAIL（問題 3）**。28 種の画面のうち、違反があるのは「作成のモーダルで画像でないファイルを選んだ後」だけ（3 幅とも `color-contrast` と `listitem`）。ホーム・その他のメニュー・検索と通知のパネル・作成のモーダル 3 段・プロフィール・投稿の画面とモーダル・ストーリー・`/notifications`・`/explore/search`（0 件・結果も）・`/create`・発見・タグ・404・ログイン・登録・公開のプロフィールと投稿は 0 件。1 回目の `target-size`（続きを読む）は 0 件になった |
| 操作できる要素は 44×44px 以上 | **FAIL（問題 1・2）**。ホームと、その上に重なる全ての画面（その他のメニュー・検索と通知のパネル・作成のモーダル 4 状態）の **1280px だけ**で、おすすめの列の名前のリンク `<a>` 199×18px が 1 個（1024px 以下は列が出ない）。公開の投稿の「ログイン」のリンク 55.2×16.5px が 3 幅。それ以外は全て 44×44px 以上（「続きを読む」は 446×44px、コメントと本文の名前のリンクは 44px の高さ、投稿のモーダルの 38 要素は全て満たす） |
| キーボード | PASS。1280・1024px は Tab でナビの 7 項目に届く。375px は Shift+Tab で下部タブの 5 項目（ホーム・発見・投稿・通知・プロフィール）に届く。フォーカスの輪郭は 3 幅で Tab 60 回＋Shift+Tab 14 回とも 2px 以上 |
| 視差効果を減らす | PASS。3 幅のホーム、「その他」のメニュー、作成のモーダル、投稿のモーダルと、1280・1024px の検索・通知のパネルで、動きのある要素（transition・animation が 0 より大きい）は 0 |
| コンソール・ネットワーク | PASS（下の節） |
| 回帰 | `a11y.spec.ts`・`keyboard.spec.ts`・`reduced-motion.spec.ts` は緑（22 件）。下の 3 つは、この E2E が見ていない所（`a11y.spec.ts` は 375px の画面だけ。おすすめの列は 1280px のみ、エラーは不正なファイルの状態、「ログイン」のリンクは公開の投稿のコメントの所） |

## ブラウザの状態

| 画面 | コンソールのエラー・警告 | 失敗した通信 |
|---|---|---|
| ログイン後の正常な操作（3 幅。ホーム・プロフィール・投稿・モーダル・パネル・作成・発見・検索・通知・ストーリーの画面。延べ 97 回の移動） | 0 | `/api/notifications/stream` の `net::ERR_ABORTED` が各幅で 1 種類（ページの移動で通知の配信を閉じた分。HTTP の失敗ではない）。HTTP 400 以上は 0 |
| ログイン後の失敗の経路（存在しない URL・ストーリー・プロフィール・タグ。各幅の別のコンテキスト） | 起こした 404 の 4 件のみ（各幅） | 同上。HTTP は起こした 404 の 4 件のみ |
| キーボード・視差効果を減らす設定 | 0 | 配信の `ERR_ABORTED` のみ。1280px の視差効果の試験で、移動の最中に画像 1 枚（`w320.webp`）の `ERR_ABORTED` が 1 件（移動で打ち切られた分。HTTP の失敗ではない） |
| ログイン前の画面（ログイン・登録・公開・誤り・空の送信） | 0 | 0 |

1 回目にあった story 画像の ORB の失敗は、今回はストーリーの画像ファイルを入れたので出ない。

## 回帰

| 確認 | コマンド | 終了コード |
|---|---|---|
| a11y・keyboard・reduced-motion の E2E（22 件） | `PORT=3101 npx playwright test -c .tmp_epic87r2/pw.config.ts a11y keyboard reduced-motion` | 0（22 passed） |
| ブランド | `npx vitest run src/shared/ui/brand.test.ts`（4 件） | 0 |
| 試験の手順（6 件） | `PORT=3101 npx playwright test -c .tmp_epic87r2/r2.config.ts` | 0（手順が最後まで流れた。判定は測定の行で行う） |
| 子 PBI の `visual-*.spec.ts`・`node scripts/verify.mjs`・E2E の全部 | この試験の指示で流さない（マシンの共有のため） | 実施せず |

#96 の自動入力の確認は 1 回目に PASS で、今回は対象外（指示の範囲外）。

## 見つけた問題

1. **おすすめの列の名前のリンクが 44px に足りない**（AC-10、1280px のホームと、その上の全ての重ね画面）
   - 手順: 1280px でログインしてホームを開く → `main a` の高さを測る
   - 期待: 操作できる要素は全て 44×44px 以上（`a11y.spec.ts` の選び方）
   - 実際: `<aside aria-label="おすすめ"> ul > li` の中の `<a href="/<username>">` が 199×18px（行の先頭の自分のリンクは 319×44px）。axe の `target-size` は出ない（インラインのリンクのため）
   - 原因（仮説、未修正）: おすすめの列の候補の名前のリンクに、「続きを読む」・コメントの名前のリンク（#122・#124）と同じ 44px の押す範囲が無い
   - 回帰で検出されなかった理由: `a11y.spec.ts` は 375px だけで、1280px のおすすめの列が出ない
   - 画面: [AC-2-home-1280.png](evidence/epic-0087-r2/AC-2-home-1280.png)（右上）
2. **公開の投稿の「ログイン」のリンクが 44px に足りない**（AC-10、3 幅）
   - 手順: ログインせずに `/p/<id>` を開く → コメントの所の「ログインしてコメントする」
   - 期待: 44×44px 以上
   - 実際: `<p><a href="/accounts/login">ログイン</a>してコメントする</p>` の `<a>` が 55.2×16.5px
   - 原因（仮説、未修正）: インラインのリンクで、44px の押す範囲が無い
   - 画面: [AC-8-public-post-1280.png](evidence/epic-0087-r2/AC-8-public-post-1280.png)、[375](evidence/epic-0087-r2/AC-8-public-post-375.png)
3. **作成のモーダルで画像でないファイルを選んだ後のエラーが axe の重大・深刻な違反**（AC-10、3 幅）
   - 手順: 「投稿」でモーダルを開く → `x.txt` を選ぶ → axe
   - 期待: 重大・深刻な違反 0 件
   - 実際: `<ul role="alert" class="… text-danger list-none"><li>x.txt: この形式は使えません（JPEG・PNG・WebP・HEIC）</li></ul>` に 2 件。`listitem`（`li` の親が role="list" でない。`role="alert"` が `ul` の役割を上書きしている）と `color-contrast`（前景 #d62d3c・背景 #f3f5f7 で 4.46:1、基準は 4.5:1）
   - 原因（仮説、未修正）: エラーの一覧を `ul` に `role="alert"` で置いている点と、`text-danger` の色が背景 #f3f5f7 の上で 4.5:1 に足りない点
   - 画面: [AC-7-bad-file-1280.png](evidence/epic-0087-r2/AC-7-bad-file-1280.png)
4. 注記（問題ではない）: AC-2 のキャプションの `p` は 62px（先頭行の名前のリンク 44px＋18px）で、見た目は 2 行。AC-5 のモーダルの写真は 480×600px ではなく #94 の決めた値（1280px で 576×720px）。1 回目の問題（「続きを読む」の高さ）は #122・#124 で解消した。
