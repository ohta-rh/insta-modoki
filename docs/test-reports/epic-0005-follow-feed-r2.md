---
type: TestReport
title: EPIC #5 フィードとフォローの総合試験（2 回目）
description: リファクタ 52a1ddb..836c2e6 の後の 603bd41 で、EPIC #5 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）でやり直した（ADR-0048）。フィードとフォロワー・フォロー中一覧のページ送り、JS 無しのフォーム、フォローの失敗のメッセージも確かめ、全て満たした。コンソールの警告・エラーと失敗した通信は、わざと起こした分を除いて 0。結果は PASS。
tags: [epic-test]
---

# EPIC #5 フィードとフォローの総合試験（2 回目）

## 対象

- EPIC: [#5](https://github.com/ohta-rh/insta-modoki/issues/5)（子 PBI #42 フォロー・#44 ホームフィード）。1 回目: [epic-0005-follow-feed.md](epic-0005-follow-feed.md)（PASS）
- 試験した commit: `603bd41`（worktree のブランチ `epic-test/5`。統合ブランチ `m1/local-mvp` の先頭。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- やり直す理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。1 回目の後にリファクタ 52a1ddb..836c2e6（Server Action の共通の失敗の包み `src/shared/action.ts` と JS 無しのフォームの結果 `formFailure`、フィードとフォロワー・フォロー中一覧のキーセットのページ送り `src/shared/db/cursor.ts`、一覧のアバターの URL と持ち主の検索、セッションの `cache`、フォローの失敗のメッセージ `INTERNAL_MESSAGE`、E2E の `signedIn` フィクスチャ）が入った。
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`、バケット `insta-s1`、空の状態から）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP のプロファイルは別のセッションが握っていて 2 回とも起動に失敗したため、[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり Playwright の `channel: 'chrome'`・`headless: false`（使い捨てのプロファイル）の Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。写真は 16 色のパレット PNG にしてある。
- データ: アプリを起動する前に `pnpm seed:bench`（利用者 1,000 人・投稿 10,000 件）を流し、`seed_user_132`（B、フォロワー 20 人）・`seed_user_489`（C）・`seed_user_745`（D）・`seed_user_10`（K）と `demo`（100 人をフォロー）を使った。A・E は UI のサインアップで作った。D1 は読み取りだけ（`wrangler d1 execute --local`）で、並びと行の有無を確かめた（ADR-0041）。パスワードは実行時に生成し、記録していない。
- 1 回目との違い: ページ送りの並びと重複・抜けを DB の新着順と全件突き合わせた（`demo` のフィード 48 件、フォロー中一覧 100 件、B のフォロワー 21 件）。JS を切った Chrome のコンテキストでのフォームの送信（フォロー・解除・セッション切れ・ログアウト中・存在しない利用者）を足した。
- 項目ごとのデータと axe・ブラウザの状態: [summary.json](evidence/epic-0005-r2/summary.json)。試験は 1 回で通った。

## 結果

PASS。AC-1〜AC-7 を全て満たした。リファクタの影響を見た点（ページ送りの並びと重複・抜け、JS 無しのフォーム、フォローの失敗のメッセージ）はどれも壊れていない。コンソールのエラー・警告と失敗した通信は、わざと起こした失敗を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | A（新規にサインアップ）が B のプロフィールで「フォローする」を押し、再読み込み、ホームを開く。失敗の経路として、C のフォローの POST を `abort`。存在しない利用者のプロフィール | PASS。「フォロー中」（`aria-pressed=true`）、フォロワー数 20 → 21、再読み込みしても同じ。ホームは B の 10 件だけで、順序は DB の新着順と一致。通信を落とすと `INTERNAL_MESSAGE` の「エラーが発生しました。しばらくしてからもう一度お試しください」が `role="alert"` に出て、「フォローする」・20 に戻る。存在しない利用者は HTTP 404 | 前 [1280](evidence/epic-0005-r2/ac1-before-1280.png)・[768](evidence/epic-0005-r2/ac1-before-768.png)・[375](evidence/epic-0005-r2/ac1-before-375.png)、後 [1280](evidence/epic-0005-r2/ac1-followed-1280.png)・[768](evidence/epic-0005-r2/ac1-followed-768.png)・[375](evidence/epic-0005-r2/ac1-followed-375.png)、ホーム [1280](evidence/epic-0005-r2/ac1-home-1280.png)・[768](evidence/epic-0005-r2/ac1-home-768.png)・[375](evidence/epic-0005-r2/ac1-home-375.png)、失敗 [1280](evidence/epic-0005-r2/ac1-failure-rolled-back-1280.png)・[768](evidence/epic-0005-r2/ac1-failure-rolled-back-768.png)・[375](evidence/epic-0005-r2/ac1-failure-rolled-back-375.png) |
| AC-2 | A が C・D もフォローしてホームをスクロール。失敗の経路として次ページの Server Action を `abort`。長いフィードとして `demo`（100 人をフォロー）を 4 ページ目まで | PASS。件数 12 → 24 → 30、重複 0、順序は DB の新着順（B・C・D の 30 件）と一致、「ここまでです」が出て番兵は消える。次ページが失敗すると「通信に失敗しました」が出て表示済みの 12 件は残り、「もう一度読み込む」で 24 → 30 件。`demo` は 12 → 24 → 36 → 48 件で、重複 0、順序は DB の新着順（フォロー中 100 人の投稿の上位 48 件）と一致（抜けなし） | 12 件 [1280](evidence/epic-0005-r2/ac2-first-12-1280.png)・[768](evidence/epic-0005-r2/ac2-first-12-768.png)・[375](evidence/epic-0005-r2/ac2-first-12-375.png)、24 件 [1280](evidence/epic-0005-r2/ac2-second-24-1280.png)・[768](evidence/epic-0005-r2/ac2-second-24-768.png)・[375](evidence/epic-0005-r2/ac2-second-24-375.png)、末尾 [1280](evidence/epic-0005-r2/ac2-end-1280.png)・[768](evidence/epic-0005-r2/ac2-end-768.png)・[375](evidence/epic-0005-r2/ac2-end-375.png)、失敗 [1280](evidence/epic-0005-r2/ac2-failure-alert-1280.png)・[768](evidence/epic-0005-r2/ac2-failure-alert-768.png)・[375](evidence/epic-0005-r2/ac2-failure-alert-375.png)、demo 48 件 [1280](evidence/epic-0005-r2/ac2-demo-48-1280.png)・[768](evidence/epic-0005-r2/ac2-demo-48-768.png)・[375](evidence/epic-0005-r2/ac2-demo-48-375.png) |
| AC-3 | A が B の「フォロー中」を押して解除し、再読み込み、ホームを開き直す。失敗の経路として C の解除の POST を `abort` | PASS。「フォローする」・21 → 20、再読み込みしても同じ。ホームに B の投稿は無く（C・D の 20 件を最後まで読んで B は 0 件）。解除の通信が失敗すると案内が出て「フォロー中」・21 のまま | 解除後 [1280](evidence/epic-0005-r2/ac3-unfollowed-1280.png)・[768](evidence/epic-0005-r2/ac3-unfollowed-768.png)・[375](evidence/epic-0005-r2/ac3-unfollowed-375.png)、ホーム [1280](evidence/epic-0005-r2/ac3-home-1280.png)・[768](evidence/epic-0005-r2/ac3-home-768.png)・[375](evidence/epic-0005-r2/ac3-home-375.png)、失敗 [1280](evidence/epic-0005-r2/ac3-failure-rolled-back-1280.png)・[768](evidence/epic-0005-r2/ac3-failure-rolled-back-768.png)・[375](evidence/epic-0005-r2/ac3-failure-rolled-back-375.png) |
| AC-4 | B（21 フォロワー）の「21 フォロワー」を開いてスクロール。`demo` の「100 フォロー中」を最後までスクロール。空の一覧、存在しない利用者の一覧 | PASS。フォロワーは 20 件 → 21 件、A が一覧にあり、21 件の順序は DB の新着順と一致、重複 0。フォロー中（`demo`）は 20 → 40 → 100 件で、重複 0、順序は DB の新着順と一致（抜けなし）。空の一覧は「まだフォロワーはいません」「まだ誰もフォローしていません」、存在しない利用者の一覧は HTTP 404 | ヘッダー [1280](evidence/epic-0005-r2/ac4-profile-header-1280.png)・[768](evidence/epic-0005-r2/ac4-profile-header-768.png)・[375](evidence/epic-0005-r2/ac4-profile-header-375.png)、フォロワー 20 件 [1280](evidence/epic-0005-r2/ac4-followers-20-1280.png)・[768](evidence/epic-0005-r2/ac4-followers-20-768.png)・[375](evidence/epic-0005-r2/ac4-followers-20-375.png)、21 件 [1280](evidence/epic-0005-r2/ac4-followers-21-1280.png)・[768](evidence/epic-0005-r2/ac4-followers-21-768.png)・[375](evidence/epic-0005-r2/ac4-followers-21-375.png)、フォロー中 [1280](evidence/epic-0005-r2/ac4-following-20-then-more-1280.png)・[768](evidence/epic-0005-r2/ac4-following-20-then-more-768.png)・[375](evidence/epic-0005-r2/ac4-following-20-then-more-375.png)、100 件の末尾 [1280](evidence/epic-0005-r2/ac4-following-100-end-1280.png)・[768](evidence/epic-0005-r2/ac4-following-100-end-768.png)・[375](evidence/epic-0005-r2/ac4-following-100-end-375.png)、空 [1280](evidence/epic-0005-r2/ac4-empty-followers-1280.png)・[768](evidence/epic-0005-r2/ac4-empty-followers-768.png)・[375](evidence/epic-0005-r2/ac4-empty-followers-375.png) |
| AC-5 | ログアウト中に `/` を開き、B のプロフィールの「フォローする」を押す。A が自分のプロフィールを開く。JS を切って、フォームでフォロー・解除、セッション切れでの送信、ログアウト中の押下、存在しない利用者への送信 | PASS。`/` と「フォローする」（`/accounts/login` へのリンク）はログイン画面へ。自分のプロフィールにフォローボタン 0 個、「プロフィールを編集」1 個。JS 無しで、K のフォームを押すとページが描き直されて「フォロー中」（DB の行 1）、もう一度押すと「フォローする」（行 0）。Cookie を消してからフォームを送ると `/accounts/login` へ移り、行は作られない（`formFailure` の UNAUTHENTICATED）。ログアウト中の JS 無しの押下もログインへ。存在しない利用者へのフォームの送信は HTTP 404（NOT_FOUND） | ログアウト中の / [1280](evidence/epic-0005-r2/ac5-logged-out-home-1280.png)・[768](evidence/epic-0005-r2/ac5-logged-out-home-768.png)・[375](evidence/epic-0005-r2/ac5-logged-out-home-375.png)、自分 [1280](evidence/epic-0005-r2/ac5-own-profile-1280.png)・[768](evidence/epic-0005-r2/ac5-own-profile-768.png)・[375](evidence/epic-0005-r2/ac5-own-profile-375.png)、JS 無し: 前 [1280](evidence/epic-0005-r2/nojs-before-1280.png)・[768](evidence/epic-0005-r2/nojs-before-768.png)・[375](evidence/epic-0005-r2/nojs-before-375.png)、後 [1280](evidence/epic-0005-r2/nojs-followed-1280.png)・[768](evidence/epic-0005-r2/nojs-followed-768.png)・[375](evidence/epic-0005-r2/nojs-followed-375.png)、ログインへの移動 [1280](evidence/epic-0005-r2/nojs-login-redirect-1280.png)・[768](evidence/epic-0005-r2/nojs-login-redirect-768.png)・[375](evidence/epic-0005-r2/nojs-login-redirect-375.png)、存在しない利用者 [1280](evidence/epic-0005-r2/nojs-unknown-target-1280.png)・[768](evidence/epic-0005-r2/nojs-unknown-target-768.png)・[375](evidence/epic-0005-r2/nojs-unknown-target-375.png) |
| AC-6 | フォロー 0 人の新規利用者 E でホームを開く | PASS。「フォローすると、その人の投稿がここに表示されます」が 1 件、投稿 0 件、エラーの案内 0 件 | [1280](evidence/epic-0005-r2/ac6-empty-feed-1280.png)・[768](evidence/epic-0005-r2/ac6-empty-feed-768.png)・[375](evidence/epic-0005-r2/ac6-empty-feed-375.png) |
| AC-7 | 3 幅で全画面に axe。コンソールと通信。Tab・Enter・Space だけでフォロー・解除 | PASS。axe は 7 画面 × 3 幅 = 21 回で違反 0 件（重大・深刻に限らず）。コンソールと通信は下の表のとおり。Tab で「フォローする」に届き、Enter で「フォロー中」（`aria-pressed=true`）、Space で戻る。DB も同じ | [1280](evidence/epic-0005-r2/ac7-keyboard-profile-1280.png)・[768](evidence/epic-0005-r2/ac7-keyboard-profile-768.png)・[375](evidence/epic-0005-r2/ac7-keyboard-profile-375.png) |

### キーボードで届くか

[summary.json](evidence/epic-0005-r2/summary.json) の `tabOrder`（1280px）。フォロワー一覧: 本文へ移動 → ナビ → 見出し `@seed_user_132` → 一覧の各人のリンク。プロフィール: ナビ → 「フォローする」→ 「19 フォロワー」→ 「9 フォロー中」→ 投稿のグリッド。ホームのフィード: ナビ → 作者 → いいね → 件数 → コメント → 「コメント N 件をすべて見る」を投稿ごとに。空のホーム: ナビだけ。どの画面も新しい操作の部品に Tab で届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0005-r2/summary.json) の `health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ 2 人・`demo` のログイン、各プロフィール、フォロー・解除、ホーム（12・24・30・48 件の読み込み）、フォロワー一覧・フォロー中一覧（100 件まで）、空のホーム、ログアウト中の `/`、キーボード操作 | 0 | 0 |
| AC-1・AC-3 の失敗の経路（フォロー・解除の POST を `abort`）、AC-2 の失敗の経路（次ページの POST を `abort`） | `net::ERR_FAILED` 各 1 件（わざと止めた通信） | POST 各 1 件（`abort`） |
| 存在しない利用者のプロフィールと一覧 | `404` 各 1 件 | 想定の 404 各 1 件 |
| JS を切ったコンテキスト（AC-5 の JS 無しの手順） | 0 | JS のチャンクの GET が `csp` で止まった記録（JS を切ったため Chrome が読み込みを止める。製品の不具合ではない）。フォーム自体の通信の失敗は 0 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして）。typecheck・lint・format・docs・unit（443）・integration（226、4 件は skip）・build・e2e（139 件。`follow.spec.ts`・`feed.spec.ts` を含む）・perf-budget が全て OK。記録: [verify.txt](evidence/epic-0005-r2/verify.txt) | 0 |

## 見つけた問題

なし。

（気づき。AC の判定に影響しない）`seed:bench` の `follows.created_at` は試験の日時より先の値を含むため、B のフォロワー一覧で A は先頭ではなく 12 番目に出る。並びは DB の新着順と一致している（1 回目と同じ。実際の利用では起きない）。
