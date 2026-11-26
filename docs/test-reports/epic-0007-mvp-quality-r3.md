---
type: TestReport
title: EPIC #7 MVP の品質の総合試験（3 回目）
description: AC-2（LCP 2.5 秒以内）が main 9a70b8e で落ちたため、バグ PBI #132 の修正後の main 5d90708 でやり直した。AC-1・4・5・6 は実ブラウザ（Google Chrome 158）で、AC-2・3 は ADR-0046 の計測で確かめ、全て満たした。コンソールの警告・エラーと失敗した通信は、想定した 404 と画面遷移で中断される通知ストリームを除いて 0。
tags: [epic-test]
---

# EPIC #7 MVP の品質の総合試験（3 回目）

## 対象

- EPIC: [#7](https://github.com/ohta-rh/insta-modoki/issues/7)（子 PBI #36・#45・#46、後から足した #132）。[1 回目](epic-0007-mvp-quality.md)・[2 回目](epic-0007-mvp-quality-r2.md)の PASS の後、`main` 9a70b8e で AC-2 の LCP が基準を超えたため EPIC を開き直し、#132 が直した（CI の perf で `/` の lcpMs 2270）。その修正後をやり直した。
- 試験した commit: `5d90708`（`main` = `origin/m4/phase3`。ブランチ `epic-test/7`）
- 日付: 2026-11-26
- スロット: 3（`http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`、バケット `insta-s3`、空にしてから）
- OS: macOS 26.2（Darwin 25.2.0）
- ブラウザ: Google Chrome 158.0.8127.37（安定版、画面あり）。AC-2・3 の計測は [ADR-0046](../adr/0046-performance-budget-in-verify-and-ci.md) のとおり Playwright 同梱の Chromium + Lighthouse。
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は 1280（高さ 900）・768（1024）・375（812）。AC-4 の axe は幅 375px。
- データ: AC-1・4・5・6 は `seed:demo`（`seed: demo OK users=30 posts=300 media=473`）。AC-5 は UI でサインアップして作った利用者 1 人。AC-2・3 は `slot reset` の後の `seed:bench`（`seed: bench OK users=1000 posts=10000`）。パスワードは実行時に生成し、どこにも書いていない。
- 実行時の負荷: `uptime` の load は 8〜11（他のスロットの実装者が並行で動いていた。共有の Garage も他スロットの削除で混んでいた）。
- 項目ごとのデータ・axe・Tab の順・ブラウザの状態: [summary.json](evidence/epic-0007-r3/summary.json)

## 結果

PASS。AC-1〜AC-6 を全て満たした。AC-2 の LCP は 2 回の計測で `/` が 2456ms・2129ms で基準 2500ms 以内（1 回目は余裕 44ms と小さい。下の「性能の指標」）。最後の行は 2 回とも `perf: OK`。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `seed:demo` → `demo` でログイン → フィードとプロフィール。失敗の経路: 間違ったパスワード、存在しないユーザーのプロフィール | PASS。シードは 30 人・300 件。フィードに投稿 12 件（画像 25 枚）。プロフィールは 3 列（`124.3px 124.3px 124.3px`）、1 ページ目に 10 件（10 投稿・10 フォロワー・20 フォロー中）。間違ったパスワードは「メールアドレスまたはパスワードが違います」で `/accounts/login` のまま。存在しないユーザーは 404 | フィード [1280](evidence/epic-0007-r3/ac1-feed-1280.png)・[768](evidence/epic-0007-r3/ac1-feed-768.png)・[375](evidence/epic-0007-r3/ac1-feed-375.png)；プロフィール [1280](evidence/epic-0007-r3/ac1-profile-1280.png)・[768](evidence/epic-0007-r3/ac1-profile-768.png)・[375](evidence/epic-0007-r3/ac1-profile-375.png)；ログイン拒否 [1280](evidence/epic-0007-r3/ac1-login-refused-1280.png)・[768](evidence/epic-0007-r3/ac1-login-refused-768.png)・[375](evidence/epic-0007-r3/ac1-login-refused-375.png)；404 [1280](evidence/epic-0007-r3/ac1-unknown-profile-1280.png)・[768](evidence/epic-0007-r3/ac1-unknown-profile-768.png)・[375](evidence/epic-0007-r3/ac1-unknown-profile-375.png)；[seed-demo.txt](evidence/epic-0007-r3/seed-demo.txt) |
| AC-2 | ビルド済みと `seed:bench` の後に `PORT=3103 node scripts/perf/run.mjs` を 2 回 | PASS。Lighthouse はフィード 96・98、プロフィール 100、投稿詳細 100（90 以上）。LCP は `/` 2456ms・2129ms、`/demo` 1527ms、投稿詳細 1378〜1380ms（2500ms 以下）。CLS は最大 0.0016、INP 40ms。どちらも最後の行は `perf: OK`、終了コード 0 | [perf1.txt](evidence/epic-0007-r3/perf1.txt)、[perf2.txt](evidence/epic-0007-r3/perf2.txt) |
| AC-3 | 同じ実行のフィード API 200 回と `node scripts/perf/bundle.mjs` | PASS。p95 は 38ms・38ms（300ms 以内）。初期 JS は gzip 158,519 バイト（実行内）・158,334 バイト（`bundle.mjs`）で 170,000 以内 | [perf1.txt](evidence/epic-0007-r3/perf1.txt)、[perf2.txt](evidence/epic-0007-r3/perf2.txt)、[bundle.txt](evidence/epic-0007-r3/bundle.txt) |
| AC-4 | 実 Chrome の `@axe-core/playwright`（wcag2a・2aa・21a・21aa・22aa）を主要 8 画面・投稿のモーダルに、幅 375px で。`e2e/a11y.spec.ts` | PASS。10 の状態（サインアップ、ログイン、ホームフィード、プロフィール、プロフィールの編集、投稿の作成、投稿詳細、フォロワーの一覧、投稿のモーダル、AC-5 のコメント後の投稿詳細）全てで違反 0 件（重大・深刻だけでなく全ての違反が 0）。`a11y.spec.ts` ほかは [specs.txt](evidence/epic-0007-r3/specs.txt) で全て passed | フィード（AC-1 と同じ）；プロフィール（同）；投稿詳細 [1280](evidence/epic-0007-r3/ac4-detail-1280.png)・[768](evidence/epic-0007-r3/ac4-detail-768.png)・[375](evidence/epic-0007-r3/ac4-detail-375.png)；編集 [1280](evidence/epic-0007-r3/ac4-edit-1280.png)・[768](evidence/epic-0007-r3/ac4-edit-768.png)・[375](evidence/epic-0007-r3/ac4-edit-375.png)；作成 [1280](evidence/epic-0007-r3/ac4-create-1280.png)・[768](evidence/epic-0007-r3/ac4-create-768.png)・[375](evidence/epic-0007-r3/ac4-create-375.png)；フォロワー [1280](evidence/epic-0007-r3/ac4-followers-1280.png)・[768](evidence/epic-0007-r3/ac4-followers-768.png)・[375](evidence/epic-0007-r3/ac4-followers-375.png)；モーダル [1280](evidence/epic-0007-r3/ac4-modal-1280.png)・[768](evidence/epic-0007-r3/ac4-modal-768.png)・[375](evidence/epic-0007-r3/ac4-modal-375.png)；サインアップ [1280](evidence/epic-0007-r3/ac4-signup-1280.png)・[768](evidence/epic-0007-r3/ac4-signup-768.png)・[375](evidence/epic-0007-r3/ac4-signup-375.png)；ログイン [1280](evidence/epic-0007-r3/ac4-login-1280.png)・[768](evidence/epic-0007-r3/ac4-login-768.png)・[375](evidence/epic-0007-r3/ac4-login-375.png) |
| AC-5 | 実 Chrome で、マウスを使わず Tab・Enter・文字入力・ファイル選択だけで、サインアップ → 投稿 → いいね → コメント。失敗の経路: 不正なメールアドレスと短いパスワードで Enter、空のコメント | PASS。不正な入力は「メールアドレスの形式を確認してください」「パスワードは 8〜72 字で入力してください」で `/accounts/signup` のまま。正しい入力で `/` → `/create` → `/p/<id>`。いいねは `aria-pressed=true`。空のコメントは「投稿」が無効、入力して送るとコメントが出る。`mousedown`・`pointerdown`・`mouseup`・実クリックは 0 回 | サインアップの誤り [1280](evidence/epic-0007-r3/ac5-signup-error-1280.png)・[768](evidence/epic-0007-r3/ac5-signup-error-768.png)・[375](evidence/epic-0007-r3/ac5-signup-error-375.png)；ホーム [1280](evidence/epic-0007-r3/ac5-home-1280.png)・[768](evidence/epic-0007-r3/ac5-home-768.png)・[375](evidence/epic-0007-r3/ac5-home-375.png)；投稿の入力 [1280](evidence/epic-0007-r3/ac5-create-filled-1280.png)・[768](evidence/epic-0007-r3/ac5-create-filled-768.png)・[375](evidence/epic-0007-r3/ac5-create-filled-375.png)；投稿 [1280](evidence/epic-0007-r3/ac5-post-1280.png)・[768](evidence/epic-0007-r3/ac5-post-768.png)・[375](evidence/epic-0007-r3/ac5-post-375.png)；いいね [1280](evidence/epic-0007-r3/ac5-liked-1280.png)・[768](evidence/epic-0007-r3/ac5-liked-768.png)・[375](evidence/epic-0007-r3/ac5-liked-375.png)；コメント [1280](evidence/epic-0007-r3/ac5-commented-1280.png)・[768](evidence/epic-0007-r3/ac5-commented-768.png)・[375](evidence/epic-0007-r3/ac5-commented-375.png) |
| AC-6 | 実 Chrome の `reducedMotion: 'reduce'` と `'no-preference'` で、複数枚の投稿のカルーセルとプロフィールのグリッドから開くモーダル | PASS。reduce では `matchMedia` が true、カルーセルは `scroll-behavior: auto`・transition と animation は `0s`、モーダルは `0s`。no-preference では `smooth`、モーダルの animation は `0.15s` | カルーセル reduce [1280](evidence/epic-0007-r3/ac6-carousel-reduce-1280.png)・[768](evidence/epic-0007-r3/ac6-carousel-reduce-768.png)・[375](evidence/epic-0007-r3/ac6-carousel-reduce-375.png)；カルーセル no-preference [1280](evidence/epic-0007-r3/ac6-carousel-no-preference-1280.png)・[768](evidence/epic-0007-r3/ac6-carousel-no-preference-768.png)・[375](evidence/epic-0007-r3/ac6-carousel-no-preference-375.png)；モーダル reduce [1280](evidence/epic-0007-r3/ac6-modal-reduce-1280.png)・[768](evidence/epic-0007-r3/ac6-modal-reduce-768.png)・[375](evidence/epic-0007-r3/ac6-modal-reduce-375.png)；モーダル no-preference [1280](evidence/epic-0007-r3/ac6-modal-no-preference-1280.png)・[768](evidence/epic-0007-r3/ac6-modal-no-preference-768.png)・[375](evidence/epic-0007-r3/ac6-modal-no-preference-375.png) |

### キーボードで届くか

幅 375px、`demo` でログイン（[summary.json](evidence/epic-0007-r3/summary.json) の `tabOrder`）。Tab を最大 60 回押し、フィードは 60 個（上限）、プロフィール 21 個、投稿詳細 37 個、フォロワーの一覧 18 個の操作要素に届いた。順序は作者 → 操作ボタン → いいね → コメントなど、見た目の順と同じで、フォーカスが先頭に戻って終わる。DOM 内の要素数との差は、画面外・非表示の要素と、フィードの 60 回の上限による。

## 性能の指標と 2 回目との差

fix 前の `main` 9a70b8e では `/` の LCP が基準を超えた。今回は #132 の後で、CI の perf は `/` lcpMs 2270。

| 指標 | 画面 | 2 回目（`eb2ec7b`） | 今回の 1 回目 | 今回の 2 回目 | 基準 |
|---|---|---|---|---|---|
| lighthouseScore | `/` | 96 / 97 | 96 | 98 | 90 以上 |
| lcpMs | `/` | 2416 / 2278 | 2456 | 2129 | 2500 以下 |
| cls | `/` | 0 | 0.0016 | 0.0016 | 0.1 以下 |
| lcpMs | `/demo` | 1675 / 1673 | 1527 | 1527 | 2500 以下 |
| lcpMs | 投稿詳細 | 1508 / 1377 | 1378 | 1380 | 2500 以下 |
| inpMs | `/` | 40 | 40 | 40 | 200 以下 |
| feedApiP95Ms | `GET /` | 120 / 33 | 38 | 38 | 300 以下 |
| initialJsGzipBytes | `/` | 150,797 | 158,519 | 158,519 | 170,000 以下 |

- `/` の LCP は 2 回の間で 2456ms と 2129ms に揺れた（負荷が高い機械で他スロットが動いていた）。1 回目は基準まで 44ms と余裕が小さい。基準は緩めていない。2 回とも `perf: OK`。
- 初期 JS は 2 回目より +7,722 バイト（+5.1%）。基準まで約 11,500 バイトで、余裕が減っている。製品の不具合ではないが、次に JS を足す PBI は注意が要る。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0007-r3/summary.json) の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| ログイン（拒否・成功）、AC-4 の 8 画面とモーダル、カルーセルとモーダル（reduce・no-preference）、AC-5 のサインアップ・投稿の作成・投稿詳細・いいね・コメント | 0 | 0（ただし下の `/api/notifications/stream` の ERR_ABORTED を除く） |
| 存在しないユーザーのプロフィール（AC-1 の失敗の経路） | 試験のために起こした 404 の `Failed to load resource` 1 件（想定どおり） | 404 の応答 1 件（起こしたもの） |

- ログイン後の画面では、画面を移動するたびに、サーバー送信イベントの `GET /api/notifications/stream` が `net::ERR_ABORTED` として 1 件ずつ数えられた。長く開いたままのストリームを、ページ移動で自分から切ったもので、応答の状態 400 以上ではなく、画面の表示も壊れていない。2 回目の報告では 0 だったので、数え方の違いかどうかは調べていない（計測のスクリプトは `requestfailed` を全て数えている）。製品の不具合とは判断していない。
- AC-2・3 の計測（同梱の Chromium）では、コンソールや通信の数は取っていない（ADR-0046 の計測）。

## 回帰

| 確認 | 終了コード・結果 |
|---|---|
| `pnpm build`（[build.txt](evidence/epic-0007-r3/build.txt)） | `rc=0`、`OpenNext build complete.` |
| `pnpm seed:bench`、`pnpm seed:demo`（[seed-bench.txt](evidence/epic-0007-r3/seed-bench.txt)、[seed-demo.txt](evidence/epic-0007-r3/seed-demo.txt)） | `rc=0`・`rc=0`、`seed: bench OK users=1000 posts=10000`・`seed: demo OK users=30 posts=300 media=473` |
| `PORT=3103 node scripts/perf/run.mjs`（2 回）、`node scripts/perf/bundle.mjs` | `rc=0`・`rc=0`・`rc=0`、最後の行 `perf: OK`・`perf: OK`・`bundle: initial js gzip=158334 limit=170000` |
| `PORT=3103 pnpm exec playwright test e2e/a11y.spec.ts e2e/keyboard.spec.ts e2e/reduced-motion.spec.ts e2e/seed.spec.ts e2e/visual-feed.spec.ts`（実際には設定の依存で 384 件）。[specs.txt](evidence/epic-0007-r3/specs.txt) | `rc=0`、`384 passed (3.2m)` |
| `PORT=3103 node scripts/verify.mjs`（他の verify の終わりを待ってから実行）。末尾 `verify: OK 5d90708`。[verify.txt](evidence/epic-0007-r3/verify.txt) | `rc=0` |

## 見つけた問題

なし。EPIC #7 の AC を落とす問題は無かった。

試験の途中で起きた、製品の不具合ではないもの（記録のみ）:

- Playwright の `extraHTTPHeaders`（`cf-connecting-ip`）をコンテキストに付けたまま画像を投稿すると、Garage への PUT の preflight が `cf-connecting-ip` を許可されず 403（CORS）になり、「アップロードに失敗しました」が出た。試験の道具の側の設定で、e2e の `keyboard.spec.ts` と同じく、サインアップの後にヘッダーを外して解決した。
- 失敗するログインを繰り返したため、`demo` のログインが「操作が多すぎます」になった。サーバーを止めて `rate_limits` の行を消し、サーバーを起こし直して続けた。製品の挙動（レート制限）として正しい。
