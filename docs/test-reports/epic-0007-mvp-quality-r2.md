---
type: TestReport
title: EPIC #7 MVP の品質の総合試験（2 回目）
description: ADR-0048 によるやり直し。リファクタ 52a1ddb..836c2e6 の後の統合ブランチ eb2ec7b で、EPIC #7 の 6 つの受け入れ条件を再び確かめた。AC-1・4・5・6 と 4 つのダイアログは実ブラウザ（Google Chrome 157）で、AC-2・3 は ADR-0046 の計測で。全て満たし、コンソールの警告・エラーと失敗した通信は 0（想定した 404 を除く）で、PASS。
tags: [epic-test]
---

# EPIC #7 MVP の品質の総合試験（2 回目）

## 対象

- EPIC: [#7](https://github.com/ohta-rh/insta-modoki/issues/7)（子 PBI #36 シードデータ・#45 性能の基準・#46 アクセシビリティ）。[1 回目](epic-0007-mvp-quality.md)（`9cd035f`）の PASS の後にリファクタ `52a1ddb..836c2e6`（全てのモーダルの共有フォーカストラップ、React の `cache` によるセッション確認、投稿ページのコメントの並行読み込み、keyset のページ送り、Server Action の共通ラッパー、E2E の補助関数）が入ったので、[ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md) に従ってやり直した。
- 試験した commit: `eb2ec7b`（統合ブランチ `m1/local-mvp` の先頭。ブランチ `epic-test/7`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 1（`http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`、バケット `insta-s1`、空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）。AC-2・3 の計測は [ADR-0046](../adr/0046-performance-budget-in-verify-and-ci.md) のとおり Playwright 同梱の Chromium 158.0.8127.18（Lighthouse 13.6.0）。
- 操作の手段: chrome-devtools の MCP は `list_pages` が失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は 1280（高さ 900）・768（1024）・375（812）。
- データ: AC-1・4・5・6 は `seed:demo`（30 人・300 件、`seed: demo OK users=30 posts=300 media=473`）。AC-5 は UI でサインアップして作った利用者 1 人。AC-2・3 は `slot reset` の後の `seed:bench`（`seed: bench OK users=1000 posts=10000`）。パスワードは実行時に生成し、どこにも書いていない。
- 実行時の負荷: `uptime` の load は 8〜17（並行のビルドあり。1 回目の測定は 5〜7）。項目ごとのデータ・axe・Tab の順・ブラウザの状態: [summary.json](evidence/epic-0007-r2/summary.json)

## 結果

PASS。AC-1〜AC-6 を全て満たした。コンソールのエラー・警告と失敗した通信は、AC-1 で起こした 404 を除いて 0。性能の 6 つの基準は全て満たした（フィード API の p95 は 1 回目の計測だけ負荷で 120ms に上がったが、基準の 300ms 以内で、2 回目は 33ms）。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `seed:demo` → `demo` でログイン → フィードとプロフィール。失敗の経路: 間違ったパスワード、存在しないユーザーのプロフィール | PASS。フィードに投稿 12 件（画像 25 枚）。プロフィールは 3 列、1 ページ目に 10 件（10 投稿・10 フォロワー・20 フォロー中）。間違ったパスワードは「メールアドレスまたはパスワードが違います」で `/accounts/login` のまま。存在しないユーザーは 404。1 回目と同じ値 | フィード [1280](evidence/epic-0007-r2/ac1-feed-1280.png)、[768](evidence/epic-0007-r2/ac1-feed-768.png)、[375](evidence/epic-0007-r2/ac1-feed-375.png)；プロフィール [1280](evidence/epic-0007-r2/ac1-profile-1280.png)、[768](evidence/epic-0007-r2/ac1-profile-768.png)、[375](evidence/epic-0007-r2/ac1-profile-375.png)；ログイン拒否 [1280](evidence/epic-0007-r2/ac1-login-refused-1280.png)、[768](evidence/epic-0007-r2/ac1-login-refused-768.png)、[375](evidence/epic-0007-r2/ac1-login-refused-375.png)；404 [1280](evidence/epic-0007-r2/ac1-unknown-profile-1280.png)、[768](evidence/epic-0007-r2/ac1-unknown-profile-768.png)、[375](evidence/epic-0007-r2/ac1-unknown-profile-375.png) |
| AC-2 | `seed:bench`、ビルド済みで `PORT=3101 node scripts/perf/run.mjs` を 2 回（下の表） | PASS。Lighthouse はフィード 96・97、プロフィール 99、投稿詳細 100（90 以上）。LCP は最大 2416ms（フィード、1 回目）で 2500ms 以下。CLS は全て 0、INP 40ms。どちらも `perf: OK`、終了コード 0 | [perf1.txt](evidence/epic-0007-r2/perf1.txt)、[perf2.txt](evidence/epic-0007-r2/perf2.txt) |
| AC-3 | 同じ実行のフィード API 200 回と `node scripts/perf/bundle.mjs` | PASS。p95 は 120ms（1 回目、負荷の影響）・33ms（2 回目）で 300ms 以内。初期 JS は gzip 150,797 バイト（170,000 以内）。`bundle: initial js gzip=150797 limit=170000`、終了コード 0 | [perf1.txt](evidence/epic-0007-r2/perf1.txt)、[perf2.txt](evidence/epic-0007-r2/perf2.txt)、[bundle.txt](evidence/epic-0007-r2/bundle.txt) |
| AC-4 | 実 Chrome の `@axe-core/playwright`（wcag2a・2aa・21a・21aa）を主要 8 画面・投稿のモーダルに、幅 375px で。`e2e/a11y.spec.ts` | PASS。axe は 10 の状態（8 画面、投稿のモーダル、AC-5 のコメント後の投稿詳細）全てで違反 0 件。`a11y.spec.ts`・`keyboard.spec.ts`・`reduced-motion.spec.ts` の 22 件 passed（[specs.txt](evidence/epic-0007-r2/specs.txt)） | サインアップ・ログインは axe のみ（写真は 1 回目の [ac4-s1](evidence/epic-0007/ac4-s1-1280.png)・[ac4-s2](evidence/epic-0007/ac4-s2-1280.png) と同じ画面）；ホームフィード [1280](evidence/epic-0007-r2/ac4-s3-1280.png)、[768](evidence/epic-0007-r2/ac4-s3-768.png)、[375](evidence/epic-0007-r2/ac4-s3-375.png)；プロフィール [1280](evidence/epic-0007-r2/ac4-s4-1280.png)、[768](evidence/epic-0007-r2/ac4-s4-768.png)、[375](evidence/epic-0007-r2/ac4-s4-375.png)；プロフィールの編集 [1280](evidence/epic-0007-r2/ac4-s5-1280.png)、[768](evidence/epic-0007-r2/ac4-s5-768.png)、[375](evidence/epic-0007-r2/ac4-s5-375.png)；投稿の作成 [1280](evidence/epic-0007-r2/ac4-s6-1280.png)、[768](evidence/epic-0007-r2/ac4-s6-768.png)、[375](evidence/epic-0007-r2/ac4-s6-375.png)；投稿詳細 [1280](evidence/epic-0007-r2/ac4-s7-1280.png)、[768](evidence/epic-0007-r2/ac4-s7-768.png)、[375](evidence/epic-0007-r2/ac4-s7-375.png)；フォロワーの一覧 [1280](evidence/epic-0007-r2/ac4-s8-1280.png)、[768](evidence/epic-0007-r2/ac4-s8-768.png)、[375](evidence/epic-0007-r2/ac4-s8-375.png)；投稿のモーダル [1280](evidence/epic-0007-r2/ac4-modal-1280.png)、[768](evidence/epic-0007-r2/ac4-modal-768.png)、[375](evidence/epic-0007-r2/ac4-modal-375.png)；いいねした人のダイアログ [1280](evidence/epic-0007-r2/dlg-likers-1280.png)、[768](evidence/epic-0007-r2/dlg-likers-768.png)、[375](evidence/epic-0007-r2/dlg-likers-375.png)；投稿の削除の確認 [1280](evidence/epic-0007-r2/dlg-delete-post-1280.png)、[768](evidence/epic-0007-r2/dlg-delete-post-768.png)、[375](evidence/epic-0007-r2/dlg-delete-post-375.png)；コメントの削除の確認 [1280](evidence/epic-0007-r2/dlg-delete-comment-1280.png)、[768](evidence/epic-0007-r2/dlg-delete-comment-768.png)、[375](evidence/epic-0007-r2/dlg-delete-comment-375.png)；投稿モーダルのトラップ [1280](evidence/epic-0007-r2/dlg-post-modal-1280.png)、[768](evidence/epic-0007-r2/dlg-post-modal-768.png)、[375](evidence/epic-0007-r2/dlg-post-modal-375.png) |
| AC-5 | 実 Chrome で、マウスを使わず Tab・Enter・文字入力・ファイル選択だけで、サインアップ → 投稿 → いいね → コメント。失敗の経路: 不正なメールアドレスと短いパスワードで Enter、空のコメント | PASS。不正な入力は「メールアドレスの形式を確認してください」「パスワードは 8〜72 字で入力してください」で `/accounts/signup` のまま。正しい入力で `/` → `/create` → `/p/<id>`。いいねは `aria-pressed=true`。空のコメントは「投稿」が無効、入力して送るとコメントが出る。`mousedown`・`pointerdown`・`mouseup`・実クリックは 0 回 | サインアップの誤り [1280](evidence/epic-0007-r2/ac5-signup-error-1280.png)、[768](evidence/epic-0007-r2/ac5-signup-error-768.png)、[375](evidence/epic-0007-r2/ac5-signup-error-375.png)；ホーム [1280](evidence/epic-0007-r2/ac5-home-1280.png)、[768](evidence/epic-0007-r2/ac5-home-768.png)、[375](evidence/epic-0007-r2/ac5-home-375.png)；投稿の入力 [1280](evidence/epic-0007-r2/ac5-create-filled-1280.png)、[768](evidence/epic-0007-r2/ac5-create-filled-768.png)、[375](evidence/epic-0007-r2/ac5-create-filled-375.png)；投稿 [1280](evidence/epic-0007-r2/ac5-post-1280.png)、[768](evidence/epic-0007-r2/ac5-post-768.png)、[375](evidence/epic-0007-r2/ac5-post-375.png)；いいね [1280](evidence/epic-0007-r2/ac5-liked-1280.png)、[768](evidence/epic-0007-r2/ac5-liked-768.png)、[375](evidence/epic-0007-r2/ac5-liked-375.png)；コメント [1280](evidence/epic-0007-r2/ac5-commented-1280.png)、[768](evidence/epic-0007-r2/ac5-commented-768.png)、[375](evidence/epic-0007-r2/ac5-commented-375.png) |
| AC-6 | 実 Chrome の `reducedMotion: 'reduce'` と `'no-preference'` で、複数枚の投稿のカルーセルとプロフィールのグリッドから開くモーダル | PASS。reduce では `matchMedia` が true、カルーセルの `scroll-behavior` は `auto`・transition と animation は `0s`、モーダルは `0s`。no-preference では `smooth`、モーダルの animation は `0.15s` | カルーセル reduce [1280](evidence/epic-0007-r2/ac6-carousel-reduce-1280.png)、[768](evidence/epic-0007-r2/ac6-carousel-reduce-768.png)、[375](evidence/epic-0007-r2/ac6-carousel-reduce-375.png)；カルーセル no-preference [1280](evidence/epic-0007-r2/ac6-carousel-no-preference-1280.png)、[768](evidence/epic-0007-r2/ac6-carousel-no-preference-768.png)、[375](evidence/epic-0007-r2/ac6-carousel-no-preference-375.png)；モーダル reduce [1280](evidence/epic-0007-r2/ac6-modal-reduce-1280.png)、[768](evidence/epic-0007-r2/ac6-modal-reduce-768.png)、[375](evidence/epic-0007-r2/ac6-modal-reduce-375.png)；モーダル no-preference [1280](evidence/epic-0007-r2/ac6-modal-no-preference-1280.png)、[768](evidence/epic-0007-r2/ac6-modal-no-preference-768.png)、[375](evidence/epic-0007-r2/ac6-modal-no-preference-375.png) |

### 共有フォーカストラップ（リファクタの対象。AC-4・AC-5 の操作性）

4 つのモーダルで、開いた直後のフォーカスがダイアログ内、Tab を 20 回・Shift+Tab を 20 回押してもフォーカスが外へ出ない（0 回）、Escape で閉じ、閉じた後にフォーカスが開いた要素へ戻ることを確かめた（[summary.json](evidence/epic-0007-r2/summary.json) の `dlg_*`）。いいねした人（`<dialog>`）・投稿の削除の確認・コメントの削除の確認・投稿モーダル（URL は `/demo` に戻る）の全てで、外へ出た回数 0・フォーカスの戻り先は一致。

### キーボードで届くか

375px、`demo` でログイン（[summary.json](evidence/epic-0007-r2/summary.json) の `tabOrder`）。フィード・プロフィール・投稿詳細・フォロワーの一覧の全ての操作要素に Tab で届き、順序は 1 回目と同じ（投稿詳細: 作者 → 削除 → いいね → 件数 → コメントごとの作者・返信する・削除 → コメント欄 → 下のナビ）。投稿のモーダルは Tab がダイアログ内で巡る。

## 性能の指標と 1 回目との差

feed LCP は 1 回目で基準まで約 84ms と余裕が小さかった。今回の 1 回目の計測は同じ 2416ms（余裕 84ms）、2 回目は 2278ms（余裕 222ms）。`/` の 3 回の Lighthouse は 2482・2277・2278ms（2 回目の run.json）。基準は緩めていない。

| 指標 | 画面 | 1 回目（`9cd035f`） | 今回の 1 回目 | 今回の 2 回目 | 基準 | 差（今回 2 回目 − 1 回目） |
|---|---|---|---|---|---|---|
| lighthouseScore | `/` | 96 | 96 | 97 | 90 以上 | +1 |
| lcpMs | `/` | 2416 | 2416 | 2278 | 2500 以下 | −138 |
| cls | `/` | 0 | 0 | 0 | 0.1 以下 | 0 |
| lighthouseScore | `/demo` | 99 | 99 | 99 | 90 以上 | 0 |
| lcpMs | `/demo` | 1744 | 1675 | 1673 | 2500 以下 | −71 |
| cls | `/demo` | 0 | 0 | 0 | 0.1 以下 | 0 |
| lighthouseScore | 投稿詳細 | 100 | 100 | 100 | 90 以上 | 0 |
| lcpMs | 投稿詳細 | 1506 | 1508 | 1377 | 2500 以下 | −129 |
| cls | 投稿詳細 | 0 | 0 | 0 | 0.1 以下 | 0 |
| inpMs | フィード・投稿詳細 | 32 | 40 | 40 | 200 以下 | +8 |
| feedApiP95Ms | `GET /` | 35 | 120 | 33 | 300 以下 | −2（今回 1 回目は +85） |
| initialJsGzipBytes | `/` | 150,285 | 150,797 | 150,797 | 170,000 以下 | +512（+0.3%） |

- 今回の 1 回目のフィード API の p95 120ms は、計測の最中に `uptime` の load が 13 まで上がった（並行のビルド）ときのもので、同じビルド・同じデータで 1 分後に流し直すと 33ms（200 回の最小 27.0ms・最大 67ms）。[ADR-0046](../adr/0046-performance-budget-in-verify-and-ci.md) の方法（準備 20 回の後の 200 回の最初のバイトまで）で測り直した値で、負荷が原因と判断した。どちらも基準 300ms 以内。
- INP は 3 回とも 40ms（フィード）で、1 回目の 32ms との差 +8ms は小さく、基準 200ms の 5 分の 1。
- 初期 JS の +512 バイトは 0.3% で、原因は調べていない（リファクタで足した共有コードの可能性がある）。基準まで約 19,200 バイトの余裕。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0007-r2/summary.json) の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| ログイン（成功・拒否）、フィード、プロフィール、AC-4 の 8 画面とモーダル、4 つのダイアログ、カルーセルとモーダル（reduce・no-preference）、AC-5 のサインアップ・投稿の作成・投稿詳細・いいね・コメント | 0 | 0 |
| 存在しないユーザーのプロフィール（AC-1 の失敗の経路） | 試験のために起こした 404 の `Failed to load resource` 1 件（想定どおり） | 404 の応答 1 件（起こしたもの） |

AC-2・3 の計測（同梱の Chromium）では、コンソールや通信の数は取っていない（ADR-0046 の計測）。

## 回帰

| 確認 | 終了コード |
|---|---|
| `pnpm seed:demo`、`pnpm seed:bench`（[seed-demo.txt](evidence/epic-0007-r2/seed-demo.txt)、[seed-bench.txt](evidence/epic-0007-r2/seed-bench.txt)） | 0・0 |
| `PORT=3101 pnpm exec playwright test e2e/a11y.spec.ts e2e/keyboard.spec.ts e2e/reduced-motion.spec.ts`（22 件 passed）。[specs.txt](evidence/epic-0007-r2/specs.txt) | 0 |
| `PORT=3101 node scripts/perf/run.mjs`（2 回）、`node scripts/perf/bundle.mjs` | 0・0・0 |
| `PORT=3101 node scripts/verify.mjs`（サーバーを止め、スロット 1 を空にして実行）。typecheck・lint・format・docs・unit（443）・integration（226、4 件は想定の skip）・build・e2e（139 件）・perf-budget が全て OK。[verify.txt](evidence/epic-0007-r2/verify.txt) | 0 |

## 見つけた問題

なし。EPIC #7 の AC を落とす問題は無かった。参考: 既知の #76（削除に失敗した後にフォーカスが body に落ちる）は起票済みで、今回の AC の範囲外のため確かめておらず、EPIC #7 の判定には使っていない。フィードの LCP の余裕（84〜222ms）が小さいことは 1 回目と変わらない（負荷の高い機械では超える恐れがある。製品の不具合ではない）。
