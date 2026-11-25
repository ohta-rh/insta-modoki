---
type: TestReport
title: EPIC #7 MVP の品質の総合試験（1 回目）
description: 統合ブランチ m1/local-mvp の 9cd035f で、EPIC #7 の 6 つの受け入れ条件を確かめた。AC-1・4・5・6 は実ブラウザ（Google Chrome 157）で、AC-2・3 は計測の方針（ADR-0046）どおり同梱の Chromium で。全て満たし、コンソールの警告・エラーと失敗した通信は 0（想定した 404 を除く）で、PASS。
tags: [epic-test]
---

# EPIC #7 MVP の品質の総合試験（1 回目）

## 対象

- EPIC: [#7](https://github.com/ohta-rh/insta-modoki/issues/7)（子 PBI #36 シードデータ・#45 性能の基準・#46 アクセシビリティ）
- 試験した commit: `9cd035f`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`、バケット `insta-s1`、`slot reset 1` で空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）。AC-2・3 の計測だけは [ADR-0046](../adr/0046-performance-budget-in-verify-and-ci.md) のとおり Playwright 同梱の Chromium（Lighthouse 13.6.0）
- 操作の手段: chrome-devtools の MCP は `list_pages` が失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データ: AC-1・4・6 は `seed:demo` の 30 人・300 件、AC-5 は UI でサインアップして作った利用者 1 人。AC-2・3 は `seed:bench`（1,000 人・10,000 件）。パスワードは実行時に生成し、どこにも書いていない。写真は `sharp` で作った JPEG。
- 実行時の負荷: `uptime` の load は 5〜7。写真は容量のため減色した PNG（全体で約 1.5MB）。項目ごとのデータ・axe・Tab の順・ブラウザの状態: [summary.json](evidence/epic-0007/summary.json)

## 結果

PASS。AC-1〜AC-6 を全て満たした。コンソールのエラー・警告と失敗した通信は、AC-1 で起こした 404 を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `seed:demo`（スロット 1 を空にしてから、サーバーを起動する前）→ Chrome で `demo` にログイン → フィードとプロフィールを見る。失敗の経路として、間違ったパスワードと、存在しないユーザーのプロフィール。30 人・300 件は `seed.int.test.ts -t "demo は 30 人と 300 件の投稿を作る"` | PASS。`seed: demo OK users=30 posts=300 media=473`。ログインするとフィードに投稿 12 件（画像 25 枚）。プロフィールは `grid-template-columns` が 3 列で、1 ページ目に投稿 10 件（表示は 10 投稿・10 フォロワー・20 フォロー中）。間違ったパスワードは「メールアドレスまたはパスワードが違います」で `/accounts/login` のまま。存在しないユーザーは 404。名前を指定した結合テストは 1 件 passed | フィード [1280](evidence/epic-0007/ac1-feed-1280.png)、[768](evidence/epic-0007/ac1-feed-768.png)、[375](evidence/epic-0007/ac1-feed-375.png)；プロフィール [1280](evidence/epic-0007/ac1-profile-1280.png)、[768](evidence/epic-0007/ac1-profile-768.png)、[375](evidence/epic-0007/ac1-profile-375.png)；ログイン拒否 [1280](evidence/epic-0007/ac1-login-refused-1280.png)、[768](evidence/epic-0007/ac1-login-refused-768.png)、[375](evidence/epic-0007/ac1-login-refused-375.png)；404 [1280](evidence/epic-0007/ac1-unknown-profile-1280.png)、[768](evidence/epic-0007/ac1-unknown-profile-768.png)、[375](evidence/epic-0007/ac1-unknown-profile-375.png) |
| AC-2 | スロット 1 を空にし `seed:bench`（1,000 人・10,000 件）、`pnpm build` 済みの上で `PORT=3101 node scripts/perf/run.mjs`。Playwright 同梱の Chromium での計測（[ADR-0046](../adr/0046-performance-budget-in-verify-and-ci.md)） | PASS。Lighthouse（モバイル）はフィード 96・プロフィール 99・投稿詳細 100（90 以上）。LCP は 2416・1744・1506ms（2500 以下）、CLS は全て 0、INP 32ms（200 以下）。最後の行は `perf: OK`、終了コード 0。フィードの LCP は基準まで約 84ms と余裕が小さい（[#45 のレポート](perf-2026-11-21.md)では 2288ms） | [perf-run.txt](evidence/epic-0007/perf-run.txt) |
| AC-3 | 同じ条件で、同じ実行に含まれるフィード API 200 回と `node scripts/perf/bundle.mjs` | PASS。フィード API の p95 は 35ms（300ms 以内）。`/` の初期 JS は gzip で 150,285 バイト（170,000 以内）。bundle.mjs は `bundle: initial js gzip=150285 limit=170000`、終了コード 0 | [perf-run.txt](evidence/epic-0007/perf-run.txt)、[perf-bundle.txt](evidence/epic-0007/perf-bundle.txt) |
| AC-4 | `PORT=3101 pnpm exec playwright test e2e/a11y.spec.ts` と、実 Chrome で `@axe-core/playwright` を主要 8 画面とモーダルに、幅 375px で。画面の 3 幅の写真も撮った | PASS。a11y.spec.ts を含む 22 件が全て passed（[specs.txt](evidence/epic-0007/specs.txt)）。実 Chrome の axe は 9 つの状態（8 画面 + 投稿のモーダル）全てで、重大・深刻な違反は 0 件（違反そのものが 0 件） | サインアップ [1280](evidence/epic-0007/ac4-s1-1280.png)、[768](evidence/epic-0007/ac4-s1-768.png)、[375](evidence/epic-0007/ac4-s1-375.png)；ログイン [1280](evidence/epic-0007/ac4-s2-1280.png)、[768](evidence/epic-0007/ac4-s2-768.png)、[375](evidence/epic-0007/ac4-s2-375.png)；ホームフィード [1280](evidence/epic-0007/ac4-s3-1280.png)、[768](evidence/epic-0007/ac4-s3-768.png)、[375](evidence/epic-0007/ac4-s3-375.png)；プロフィール [1280](evidence/epic-0007/ac4-s4-1280.png)、[768](evidence/epic-0007/ac4-s4-768.png)、[375](evidence/epic-0007/ac4-s4-375.png)；プロフィールの編集 [1280](evidence/epic-0007/ac4-s5-1280.png)、[768](evidence/epic-0007/ac4-s5-768.png)、[375](evidence/epic-0007/ac4-s5-375.png)；投稿の作成 [1280](evidence/epic-0007/ac4-s6-1280.png)、[768](evidence/epic-0007/ac4-s6-768.png)、[375](evidence/epic-0007/ac4-s6-375.png)；投稿詳細 [1280](evidence/epic-0007/ac4-s7-1280.png)、[768](evidence/epic-0007/ac4-s7-768.png)、[375](evidence/epic-0007/ac4-s7-375.png)；フォロワーの一覧 [1280](evidence/epic-0007/ac4-s8-1280.png)、[768](evidence/epic-0007/ac4-s8-768.png)、[375](evidence/epic-0007/ac4-s8-375.png)；投稿のモーダル [1280](evidence/epic-0007/ac4-modal-1280.png)、[768](evidence/epic-0007/ac4-modal-768.png)、[375](evidence/epic-0007/ac4-modal-375.png) |
| AC-5 | 実 Chrome で、マウスを使わず Tab・Enter・文字入力・ファイル選択ダイアログだけで、サインアップ → 投稿 → いいね → コメント。失敗の経路として、不正なメールアドレスと短いパスワードで Enter、空のコメント。`e2e/keyboard.spec.ts` | PASS。不正な入力は「メールアドレスの形式を確認してください」「パスワードは 8〜72 字で入力してください」で `/accounts/signup` のまま。正しい入力で `/` に移り、「投稿」リンク → 「写真を選ぶ」→ キャプション → 「投稿」で `/p/<id>` へ。いいねは `aria-pressed=true`。空のコメントは「投稿」が無効、入力して送るとコメントが一覧に出る。ページ内の `mousedown`・`pointerdown`・`mouseup`・実クリックのイベントは 0 回。最後の画面の axe は違反 0 件。keyboard.spec.ts は a11y・reduced-motion と合わせて 22 件 passed | サインアップの誤り [1280](evidence/epic-0007/ac5-signup-error-1280.png)、[768](evidence/epic-0007/ac5-signup-error-768.png)、[375](evidence/epic-0007/ac5-signup-error-375.png)；ホーム [1280](evidence/epic-0007/ac5-home-1280.png)、[768](evidence/epic-0007/ac5-home-768.png)、[375](evidence/epic-0007/ac5-home-375.png)；投稿の入力 [1280](evidence/epic-0007/ac5-create-filled-1280.png)、[768](evidence/epic-0007/ac5-create-filled-768.png)、[375](evidence/epic-0007/ac5-create-filled-375.png)；投稿 [1280](evidence/epic-0007/ac5-post-1280.png)、[768](evidence/epic-0007/ac5-post-768.png)、[375](evidence/epic-0007/ac5-post-375.png)；いいね [1280](evidence/epic-0007/ac5-liked-1280.png)、[768](evidence/epic-0007/ac5-liked-768.png)、[375](evidence/epic-0007/ac5-liked-375.png)；コメント [1280](evidence/epic-0007/ac5-commented-1280.png)、[768](evidence/epic-0007/ac5-commented-768.png)、[375](evidence/epic-0007/ac5-commented-375.png)；サインアップの入力 [1280](evidence/epic-0007/ac5-signup-filled-1280.png) |
| AC-6 | 実 Chrome の `reducedMotion: 'reduce'` と `'no-preference'`（コンテキストの設定）で、複数枚の投稿のカルーセルと、プロフィールのグリッドから開くモーダルを見る。`e2e/reduced-motion.spec.ts` | PASS。reduce では `matchMedia` が true、カルーセルの `scroll-behavior` は `auto`・transition と animation は `0s`、モーダルの animation は `0s`。no-preference では `smooth`、モーダルの animation は `0.15s`（0 より大きい）。reduced-motion.spec.ts の 2 件は passed | カルーセル reduce [1280](evidence/epic-0007/ac6-carousel-reduce-1280.png)、[768](evidence/epic-0007/ac6-carousel-reduce-768.png)、[375](evidence/epic-0007/ac6-carousel-reduce-375.png)；モーダル reduce [1280](evidence/epic-0007/ac6-modal-reduce-1280.png)、[768](evidence/epic-0007/ac6-modal-reduce-768.png)、[375](evidence/epic-0007/ac6-modal-reduce-375.png)；カルーセル no-preference [1280](evidence/epic-0007/ac6-carousel-no-preference-1280.png)、[768](evidence/epic-0007/ac6-carousel-no-preference-768.png)、[375](evidence/epic-0007/ac6-carousel-no-preference-375.png)；モーダル no-preference [1280](evidence/epic-0007/ac6-modal-no-preference-1280.png)、[768](evidence/epic-0007/ac6-modal-no-preference-768.png)、[375](evidence/epic-0007/ac6-modal-no-preference-375.png) |

### キーボードで届くか

375px、`demo` でログイン（[summary.json](evidence/epic-0007/summary.json) の `tabOrder`）。フィード: 本文へ移動 → 投稿ごとに作者・いいね・件数・コメントのリンク → 写真の前へ・次へ。プロフィール: 本文へ移動 → プロフィールを編集 → フォロワー → フォロー中 → グリッドの投稿とページ番号 → 下のナビ（ホーム・検索・投稿・通知・プロフィール）。投稿詳細: 作者 → 削除 → いいね → 件数 → コメントごとの作者・返信する・削除 → コメント欄 → 下のナビ。どの操作の要素にも Tab で届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0007/summary.json) の `health`。出来事があった手順だけ載る）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| ログイン（成功・拒否）、フィード、プロフィール、AC-4 の 8 画面とモーダル、カルーセルとモーダル（reduce・no-preference）、AC-5 のサインアップ・投稿の作成・投稿詳細・いいね・コメント | 0 | 0 |
| 存在しないユーザーのプロフィール（AC-1 の失敗の経路） | 試験のために起こした 404 の `Failed to load resource` 1 件（想定どおり。製品の問題ではない。駆動のスクリプトが数え直す前に消した） | 404 の応答 1 件。これも起こしたもの |

AC-2・3 の計測（同梱の Chromium）では、コンソールや通信の数は取っていない（ADR-0046 の計測であり、[#45 のレポート](perf-2026-11-21.md)で 3 画面とも 0 を確かめている）。

## 回帰

| 確認 | 終了コード |
|---|---|
| `node scripts/seed/index.ts`（`seed:demo`）、`pnpm seed:bench` | 0・0 |
| `pnpm exec vitest run src/shared/db/seed/seed.int.test.ts -t "demo は 30 人と 300 件の投稿を作る"`（1 件 passed）。[seed-int.txt](evidence/epic-0007/seed-int.txt) | 0 |
| `PORT=3101 pnpm exec playwright test e2e/a11y.spec.ts e2e/keyboard.spec.ts e2e/reduced-motion.spec.ts`（22 件 passed）。[specs.txt](evidence/epic-0007/specs.txt) | 0 |
| `PORT=3101 node scripts/perf/run.mjs`、`node scripts/perf/bundle.mjs` | 0・0 |
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止め、スロット 1 を空にして実行。`uptime` の load は 5〜6）。typecheck・lint・format・docs・unit（420）・integration（226、4 件は想定の skip）・build・e2e（139 件。子 PBI の `seed.spec.ts`・`a11y.spec.ts`・`keyboard.spec.ts`・`reduced-motion.spec.ts` を含む）・perf-budget が全て OK。記録: [verify.txt](evidence/epic-0007/verify.txt) | 0 |

## 見つけた問題

なし。（参考: フィードの LCP は 2416ms で基準の 2500ms まで約 84ms。負荷の高い機械では超える恐れがある。製品の不具合ではない。）
