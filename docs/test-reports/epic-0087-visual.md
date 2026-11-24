---
type: TestReport
title: EPIC #87 見た目の総合試験
description: 統合ブランチ m2/cloudflare-demo の f5d10e8 で、EPIC #87 の 11 の受け入れ条件を 375・1024・1280px の実ブラウザ（Google Chrome 158）で測って確かめた。AC-10 の axe（重大・深刻な違反 0 件）が、ホームの「続きを読む」のリンクの高さ 18px（target-size）で満たされず FAIL。他の 10 の AC は PASS。
tags: [epic-test]
---

# EPIC #87 見た目の総合試験

## 対象

- EPIC: [#87](https://github.com/ohta-rh/insta-modoki/issues/87)（見た目：Web 版と同じ寸法と構成で表示される）。子 PBI #88〜#100・#106 は全て閉じている
- 試験した commit: `f5d10e8`（統合ブランチ `m2/cloudflare-demo` から切った `epic-test/87`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)）
- 日付: 2026-11-24
- スロット: 1（`http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s1`、空の D1 から）
- OS: macOS 26.2
- ブラウザ: Google Chrome 158.0.8127.37（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` の画面ありの Google Chrome を使い捨てのプロファイルで起こして操作した。寸法は `getBoundingClientRect`・`getComputedStyle` で測り、画面は 1280×800・1024×768・375×812 で撮った。
- データ: 利用者 10 人・投稿 36 件（長いキャプション・3 枚・4:5 を含む）・自分の投稿 14 件・ストーリー 7 件・通知 3 件（今日・3 日前・40 日前）は、アプリ自身の E2E ハーネスの `seedSession` などで入れた。投稿の作成は UI で行った。
- 記録: [measurements-walk.json](evidence/epic-0087/measurements-walk.json)（最初の歩き）、[measurements-recheck-1.json](evidence/epic-0087/measurements-recheck-1.json)〜[-3.json](evidence/epic-0087/measurements-recheck-3.json)（歩きの測り方が合わなかった所を、各 PBI の E2E と同じ選び方で測り直したもの）、[regression-playwright.log](evidence/epic-0087/regression-playwright.log)

## 結果

FAIL。AC-1〜AC-9・AC-11 は満たした。AC-10 は、axe の `target-size`（serious）がホームの「続きを読む」で 1 種類出る（高さ 18px、基準は 24px）。他の項目（44×44px・フォーカスの輪郭・視差効果・キーボード・コンソール）は満たしている。#96 の持ち越し（自動入力の値とラベルが重ならない）は満たした。

## 受け入れ条件

測った値は ±1px で参照・各 PBI の決めた値と比べた。画像は `evidence/epic-0087/` 内（`<AC>-<手順>-<幅>.png`）。

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | ログインしてホームを 3 幅で開く。「その他」を開く。存在しない URL を開く（失敗の経路） | PASS。1280px のナビ 244px、1024px 72px（下部タブは出ない）。375px は下部タブ 50px・上部バー 45px（側のナビは出ない）。今の項目だけ塗りつぶしの SVG 1 つで線は 0px。「その他」の項目は「プロフィールを編集」「ログアウト」。存在しない URL は 404 の画面 | [1280](evidence/epic-0087/AC-1-home-nav-1280.png) [1024](evidence/epic-0087/AC-1-home-nav-1024.png) [375](evidence/epic-0087/AC-1-home-nav-375.png) / メニュー [1280](evidence/epic-0087/AC-1-more-menu-1280.png) [1024](evidence/epic-0087/AC-1-more-menu-1024.png) [375](evidence/epic-0087/AC-1-more-menu-375.png) / 404 [1280](evidence/epic-0087/AC-1-not-found-1280.png) [375](evidence/epic-0087/AC-1-not-found-375.png) |
| AC-2 | ホームのカードを測る。空のコメントを送る（失敗の経路） | PASS。キャプション 14px/18px・黒、罫線 `rgb(219,219,219)`、フィードの列・カード 470px（375px は 375px）、カードの間 20px、名前 600・時刻・「その他の操作」、いいね数（y=712）は操作の列の下端（712）、その下に長いキャプション（2 行・「続きを読む」）、最下にコメントの入力。1280px は右の列 319px（ストーリーの列との間 64px。#98 の測り方）、1024px 以下は出ない。空のコメントは送れない（ボタン無効） | [1280](evidence/epic-0087/AC-2-home-1280.png) [1024](evidence/epic-0087/AC-2-home-1024.png) [375](evidence/epic-0087/AC-2-home-375.png) |
| AC-3 | ストーリーの列を測り、1280px で「次へ」を押す。存在しない人のストーリーを開く（失敗の経路） | PASS。輪 66px・アバター 56px・名前 12px/400（`[data-story-ring]`・`[data-story-avatar]`・`[data-story-name]`）・列の下 24px・未読の輪は `linear-gradient(120deg, #0BB8A9, #2B6CF6 62%, #4F46C8)`。1280px で矢印を押すと scrollLeft が 0→10。存在しない人は 404 | [1280](evidence/epic-0087/AC-3-tray-1280.png) [送った後](evidence/epic-0087/AC-3-tray-next-1280.png) [1024](evidence/epic-0087/AC-3-tray-1024.png) [375](evidence/epic-0087/AC-3-tray-375.png) / 404 [1280](evidence/epic-0087/AC-3-story-missing-1280.png) |
| AC-4 | 自分と他人のプロフィールを測る。存在しない人（失敗の経路） | PASS。中身 935px（375px は 375px）、ユーザー名 20px/400、数の行 16px・単位 `rgb(115,115,115)`・間 40px、タブは SVG のアイコン、タイル 311×414.66px（3:4）・隙間 1px（375px は 124.33×165.77px）。375px の数の行は 3 等分（125px ずつ）で単位は 1 行（範囲の高さ 19px・行の高さ 24px） | 自分 [1280](evidence/epic-0087/AC-4-own-1280.png) [1024](evidence/epic-0087/AC-4-own-1024.png) [375](evidence/epic-0087/AC-4-own-375.png) / 他人 [1280](evidence/epic-0087/AC-4-other-1280.png) [375](evidence/epic-0087/AC-4-other-375.png) / 404 [1280](evidence/epic-0087/AC-4-not-found-1280.png) |
| AC-5 | 投稿の画面とプロフィールのグリッドから開くモーダルを測り、× で閉じる | PASS。投稿の画面は 1280・1024px とも写真 479〜480×600px（4:5）・右の列 335px・箱 817px、375px は 1 列（入力が写真の下）。モーダルは暗い背景 `oklab(0 0 0 / 0.65)` の上に 2 列で、右の列 335px・× は 44×44px で閉じて元のプロフィール URL に戻る。モーダルの写真の列は #94 の決めた値のとおり、1280px で 576×720px（画面の高さ − 80px）、1024px は幅に制約され 474.4×593px。375px は全画面の 1 列で背景は白 | 画面 [1280](evidence/epic-0087/AC-5-post-page-1280.png) [1024](evidence/epic-0087/AC-5-post-page-1024.png) [375](evidence/epic-0087/AC-5-post-page-375.png) / モーダル [1280](evidence/epic-0087/AC-5-modal-1280.png) [1024](evidence/epic-0087/AC-5-modal-1024.png) [375](evidence/epic-0087/AC-5-modal-375.png) |
| AC-6 | 1280・1024px でナビの「検索」「通知」を押し、Esc・外・同じ項目で閉じる。375px と直接のリンク。検索の 0 件（失敗の経路は下の注） | PASS。URL は `/` のまま、ナビは 72px に畳まれ、パネルは x=72・幅 397px。Esc・外をクリック・同じ項目の 3 つで閉じ、Esc の後ナビは元の幅（1280px で 244px）。通知は「今日」「今週」「それ以前」の見出しで区切られる（今日・3 日前・40 日前の通知）。`/explore/search`・`/notifications` を直接開くと今のページが出て、375px の下部タブの「通知」は `/notifications` へ移る | 検索 [1280](evidence/epic-0087/AC-6-search-1280.png) [1024](evidence/epic-0087/AC-6-search-1024.png) / 通知 [1280](evidence/epic-0087/AC-6-notif-1280.png) [1024](evidence/epic-0087/AC-6-notif-1024.png) / 直接 [通知 375](evidence/epic-0087/AC-6-notifications-page-375.png) [検索 375](evidence/epic-0087/AC-6-search-page-375.png) [通知 1280](evidence/epic-0087/AC-6-notifications-page-1280.png) [検索 1024](evidence/epic-0087/AC-6-search-page-1024.png) |
| AC-7 | 「投稿」で写真を選び、切り取り、キャプションを書いてシェア。画像でないファイル（失敗の経路）。`/create` を直接 | PASS。見ていたホームの上のモーダル（URL は `/create`、背後に main が残る、箱は 1280px で 680×724px・375px は全画面）で、3 段（選ぶ → 切り取る → キャプション）を進めて `/p/<id>` に投稿できた（3 幅とも）。`x.txt` は「この形式は使えません（JPEG・PNG・WebP・HEIC）」で先へ進まない。`/create` を直接開くと見出し「投稿を作成」の 1 ページのフォーム（モーダルでない） | 選ぶ [1280](evidence/epic-0087/AC-7-step0-select-1280.png) [1024](evidence/epic-0087/AC-7-step0-select-1024.png) [375](evidence/epic-0087/AC-7-step0-select-375.png) / 切り取り [1280](evidence/epic-0087/AC-7-step1-crop-1280.png) [375](evidence/epic-0087/AC-7-step1-crop-375.png) / キャプション [1280](evidence/epic-0087/AC-7-step2-caption-1280.png) [375](evidence/epic-0087/AC-7-step2-caption-375.png) / 投稿後 [1280](evidence/epic-0087/AC-7-shared-1280.png) [375](evidence/epic-0087/AC-7-shared-375.png) / 失敗 [1280](evidence/epic-0087/AC-7-bad-file-1280.png) [375](evidence/epic-0087/AC-7-bad-file-375.png) / 直接 [1280](evidence/epic-0087/AC-7-direct-create-1280.png) [1024](evidence/epic-0087/AC-7-direct-create-1024.png) [375](evidence/epic-0087/AC-7-direct-create-375.png) |
| AC-8 | ログイン・登録・公開のプロフィールと投稿を、ログインせずに開く。誤ったパスワード・空の送信（失敗の経路）。#96 の自動入力 | PASS。ログインは 1280px で hero と pane の左右 2 分・フォーム 536px・入力 60px・角丸 16px・ボタンの角丸 22px、登録は 1 列（hero なし）・560px（375px は 343px）。ナビは出ない。公開のプロフィールと投稿は 60px の上部バー（`header[data-public-bar]`、ロゴ・ログイン・新しいアカウントを作成。375px は「ログイン」と「新しいアカウントを作成」）が 3 幅とも出てナビは 0。誤ったパスワードは alert に理由が出て、空の登録の送信は止まる。**自動入力**: 下の節 | ログイン [1280](evidence/epic-0087/AC-8-login-1280.png) [1024](evidence/epic-0087/AC-8-login-1024.png) [375](evidence/epic-0087/AC-8-login-375.png) / 誤り [1280](evidence/epic-0087/AC-8-login-error-1280.png) / 登録 [1280](evidence/epic-0087/AC-8-signup-1280.png) [375](evidence/epic-0087/AC-8-signup-375.png) / 空の送信 [1280](evidence/epic-0087/AC-8-signup-empty-submit-1280.png) / 公開 [プロフィール 1280](evidence/epic-0087/AC-8-public-profile-1280.png) [1024](evidence/epic-0087/AC-8-public-profile-1024.png) [375](evidence/epic-0087/AC-8-public-profile-375.png) [投稿 1280](evidence/epic-0087/AC-8-public-post-1280.png) [375](evidence/epic-0087/AC-8-public-post-375.png) |
| AC-9 | 発見とタグ（空）を測る | PASS。グリッド 935px（375px は 375px）・先頭 3 つが同じ行・4 つ目は次の行・タイル 414.66px（3:4）。検索の入口は 375px だけ（1280・1024px は false）。存在しないタグは空の状態の画面 | [1280](evidence/epic-0087/AC-9-explore-1280.png) [1024](evidence/epic-0087/AC-9-explore-1024.png) [375](evidence/epic-0087/AC-9-explore-375.png) / タグ [1280](evidence/epic-0087/AC-9-tag-empty-1280.png) [375](evidence/epic-0087/AC-9-tag-empty-375.png) |
| AC-10 | 全ての画面と重ねた画面で axe・44px・キーボード・視差効果を減らす設定・コンソール | **FAIL**。下の節 | フォーカス [1280](evidence/epic-0087/AC-10-focus-ring-1280.png) [1024](evidence/epic-0087/AC-10-focus-ring-1024.png) [375](evidence/epic-0087/AC-10-focus-ring-375.png) [375 下部タブ](evidence/epic-0087/AC-10-focus-ring-bottom-375.png) |
| AC-11 | ログイン前後の画面を見る | PASS。参照の名前・ロゴは出ない（`Meta` の語は、残すべき非公式の注記「学習目的の非公式プロジェクトです。Meta 社とは関係ありません。」の中だけ）。名前は「Mado」、ログインの主のボタンは `rgb(79,70,200)`（`#4F46C8`）、ストーリーの輪は自前のグラデーション。注記は 3 幅とも残る。`brand.test.ts` 4 件緑 | [公開 1280](evidence/epic-0087/AC-11-brand-footer-1280.png) [1024](evidence/epic-0087/AC-11-brand-footer-1024.png) [375](evidence/epic-0087/AC-11-brand-footer-375.png) / [ログイン後 1280](evidence/epic-0087/AC-11-brand-home-1280.png) [375](evidence/epic-0087/AC-11-brand-home-375.png) |

注: AC-6 の「検索の 0 件」の撮影は、最初の歩きの測り方の誤り（`/search` は無く、検索のページは `/explore/search`）で撮れず、サーバーを止めたあとに気づいたので撮り直していない。パネルの出入りは `visual-side-panel.spec.ts` が緑。AC-6 の失敗の経路としては、存在しない URL への直接アクセスの 404（コンソールの節）と、狭い画面でパネルを出さないことを確かめた。AC-6 は 375px の「パネルを出さずページに移る」を下部タブの「通知」で確かめた。

### AC-8: #96 の持ち越し（自動入力の値がラベルに重ならない）

保存された情報が無いので、値を入れて `input`・`change` を送り、CDP の `CSS.forcePseudoState` で `:autofill` を当てて（`matches(':autofill') === true`）撮った。ログインのメール・パスワードと登録のメールを 1280px と 375px で撮り、PASS。ラベル（12px）は上、値は下に別の行で並び、字は重ならない。ラベルの枠の下端（y=323）は値の枠の上端（y=314）より下に入るが、それは行の高さの余白で、字の間は拡大の写真で確かめた。

- 拡大（2 倍）: [ログイン メール 1280](evidence/epic-0087/AC-8-autofill-zoom-login-email-1280.png)、[パスワード 1280](evidence/epic-0087/AC-8-autofill-zoom-login-password-1280.png)、[登録 メール 1280](evidence/epic-0087/AC-8-autofill-zoom-signup-email-1280.png)、[ログイン メール 375](evidence/epic-0087/AC-8-autofill-zoom-login-email-375.png)、[登録 メール 375](evidence/epic-0087/AC-8-autofill-zoom-signup-email-375.png)
- 全画面: [ログイン メール 1280](evidence/epic-0087/AC-8-autofill-login-email-1280.png)、[375](evidence/epic-0087/AC-8-autofill-login-email-375.png)、[登録 1280](evidence/epic-0087/AC-8-autofill-signup-email-1280.png)
- 限界: 実際のブラウザの保存情報による自動入力ではなく、`:autofill` の再現。

### AC-10: アクセシビリティ（FAIL）

| 項目 | 結果 |
|---|---|
| axe（wcag2a・2aa・21a・21aa・22aa）の重大・深刻な違反 | **FAIL**。ホームとそれを背にした全ての重ね画面（その他のメニュー・検索と通知のパネル・作成のモーダル 3 段）の 3 幅で、`target-size`（serious）が 3 要素。要素は各カードの「続きを読む」（`CaptionClamp.tsx` の `<a class="block text-text-secondary">`）。測った値: 高さ 18px（1280・1024px は幅 446px、375px は 351px）、基準は 24×24px 以上。**ホームのキャプションが 3 行以上のカードがあると出る**（長いキャプションを入れたデモのデータ）。違反が 0 件だった画面: プロフィール（自分・他人）、投稿の画面、投稿のモーダル、ログイン、登録、公開のプロフィールと投稿、発見、タグ、`/create` の 1 ページのフォーム |
| 操作できる要素は 44×44px 以上 | PASS。`a11y.spec.ts` と同じ選び方（`button, [role=button], input, select, textarea, [role=tab], nav a`）で、3 幅のホームと、検索・通知のパネルと作成のモーダルの中に 44px 未満は 0 |
| キーボード | PASS。1280・1024px は Tab でナビの 7 項目（ホーム・検索・発見・投稿・通知・プロフィール・その他）全てに届く。375px は下部タブが文書の最後にあるので Shift+Tab で届く（5 項目）。フォーカスの輪郭は 3 幅で Tab 60 回とも 2px 以上 |
| 視差効果を減らす | PASS。3 幅のホームと、1280・1024px のパネルを開いた状態で、動きのある要素（transition・animation の長さが 0 より大きい）が 0 |
| コンソール・ネットワーク | PASS（下の節） |
| 回帰 | `a11y.spec.ts`・`keyboard.spec.ts`・`reduced-motion.spec.ts` は緑（下の節）。この違反は E2E のデータにキャプションの長いカードが無いために検出されていない |

## ブラウザの状態

3 つの幅のログイン後の画面（ホーム・プロフィール・投稿・モーダル・パネル・作成・発見）と、ログイン前の画面（ログイン・登録・公開）、視差効果を減らす設定・キーボードの試験で測った。

| 画面 | コンソールのエラー・警告 | 失敗した通信 |
|---|---|---|
| ログイン後の全ての画面（正常な操作） | 0 | `/api/notifications/stream` の `net::ERR_ABORTED` が、ページを移るたびに 1 件（ページの移動で通知の配信を閉じた分。HTTP の失敗ではない） |
| 失敗の経路 | 起こした 404 のみ（存在しない URL・ストーリー・プロフィール・タグを開いた分）。1280・1024px で各 4 件、375px は `/search`（存在しない URL。検索のページは `/explore/search`）を測り間違えた分を含め 5 件 | 同上 |
| ログイン前の画面・視差効果・キーボード | 0 | 0 |
| 直接のリンク（`/explore/search`・`/notifications`、3 幅） | 0 | 0 |

HTTP 400 以上は、上の起こした 404 以外に無い。

## 回帰

通常の Playwright（画面あり Chrome、スロット 1）で、`visual-*.spec.ts` 13 ファイル（#88〜#100 の PBI の E2E）と `a11y.spec.ts`・`keyboard.spec.ts`・`reduced-motion.spec.ts` を流した。ログ: [regression-playwright.log](evidence/epic-0087/regression-playwright.log)

| 確認 | コマンド | 終了コード |
|---|---|---|
| 子 PBI の E2E と a11y・keyboard・reduced-motion | `PORT=3101 npx playwright test -c .tmp_epic87/pw.config.ts`（140 件） | 0（140 passed） |
| ブランド | `npx vitest run src/shared/ui/brand.test.ts`（4 件） | 0 |
| `node scripts/verify.mjs`・E2E の全部 | この試験の指示で流さない（マシンの共有のため） | 実施せず |

## 見つけた問題

1. **ホームの「続きを読む」のリンクが target-size（24px）に足りない**（AC-10、全幅）
   - 手順: ログインしてホームを開く（キャプションが 2 行を超えるカードがあるデータ）→ axe を流す
   - 期待: 重大・深刻な違反が 0 件（`target-size` は 24×24px 以上）
   - 実際: `target-size` が 3 要素。各カードの「続きを読む」が 446×18px（375px は 351×18px）。ホームの上に重なる画面（メニュー・パネル・作成のモーダル）でも、背のホームのせいで同じ違反
   - 原因（仮説、未修正）: `src/features/post/ui/CaptionClamp.tsx` のリンクが `block` で、高さが行の高さ 18px のまま（`min-h` のような余白が無い）
   - 画面: [AC-2-home-1280.png](evidence/epic-0087/AC-2-home-1280.png)（カードの「続きを読む」）、測定値は [measurements-recheck-1.json](evidence/epic-0087/measurements-recheck-1.json)
   - 回帰で検出されなかった理由: `a11y.spec.ts` のデータにキャプションの長い投稿が無い
2. 注記（問題ではない）: AC-2 の「中央との間 64px」は #98 の E2E と同じく「ストーリーの列（630px）の右端から右の列まで」で測って 64px。カード（470px）の右端からは 144px で、これは参照の 630px の中央の列にカードが左寄せで入る構成による。AC-5 のモーダルの写真は 480×600px ではなく #94 の決めた値（1280px で 576×720px）。
