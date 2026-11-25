---
type: TestReport
title: EPIC #5 フィードとフォローの総合試験（1 回目）
description: 統合ブランチ m1/local-mvp の 2f2e1c4 で、EPIC #5 の 7 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。全て満たし、コンソールの警告・エラーと失敗した通信は 0（失敗の経路のために起こした分を除く）で、PASS。
tags: [epic-test]
---

# EPIC #5 フィードとフォローの総合試験（1 回目）

## 対象

- EPIC: [#5](https://github.com/ohta-rh/insta-modoki/issues/5)（子 PBI #42 フォロー・#44 ホームフィード）
- 試験した commit: `2f2e1c4`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 4（アプリ `http://localhost:3104`、`pnpm build` → `PORT=3104 pnpm start`、バケット `insta-s4`、`slot reset 4` で空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。写真は証拠の大きさのため 16 色のパレット PNG にしてある。
- データ: アプリを起動する前に `pnpm seed:bench`（利用者 1,000 人・投稿 10,000 件・フォロー）を流し、そのうち `seed_user_132`（B、フォロワー 20 人）・`seed_user_489`（C）・`seed_user_745`（D）・`seed_user_10`（K）と `demo`（100 人をフォロー）を使った。A（フォローする側）と E（フォロー 0 人）は UI のサインアップで作った。シードの利用者は 1 人 10 件の投稿のため、AC-2 は B・C・D をフォローして 30 件にして確かめた。D1 への書き込みは試験の側からはしていない（読み取りだけ `wrangler d1 execute --local` で、並びと行の有無を確かめた。ADR-0041）。パスワードは実行時に生成し、どこにも書いていない。
- 試験は 3 回流した。1 回目はデータベースの大文字小文字の想定の誤り（サインアップのユーザー名は小文字で保存される）、2 回目は件数の記録の取りこぼし（30 件目が読み込まれた後に数えた）という試験の手順の誤りで落ち、スロットを空にして最初からやり直した。ここに載せるのは 3 回目の結果。
- 項目ごとのデータと axe・ブラウザの状態: [summary.json](evidence/epic-0005/summary.json)

## 結果

PASS。AC-1〜AC-7 を全て満たした。コンソールのエラー・警告と失敗した通信は、失敗の経路のために起こした分を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | A（新規にサインアップ）が B（`seed_user_132`、投稿 10 件、フォロワー 20 人）のプロフィールで「フォローする」を押し、ホームを開く。再読み込み。失敗の経路として、C のプロフィールで通信を `abort` して押す。存在しない利用者のプロフィール | PASS。ボタンが「フォロー中」（`aria-pressed=true`）に変わり、フォロワー数が 20 → 21。再読み込みしても同じ。ホームは B の 10 件だけで、先頭は B の最新の投稿（DB の新着順と 10 件とも一致）。通信を落とすと「エラーが発生しました。しばらくしてからもう一度お試しください」が出て、「フォローする」・20 に戻る。存在しない利用者は HTTP 404 | 前 [1280](evidence/epic-0005/ac1-before-1280.png)、[768](evidence/epic-0005/ac1-before-768.png)、[375](evidence/epic-0005/ac1-before-375.png)；押した後 [1280](evidence/epic-0005/ac1-followed-1280.png)、[768](evidence/epic-0005/ac1-followed-768.png)、[375](evidence/epic-0005/ac1-followed-375.png)；ホーム [1280](evidence/epic-0005/ac1-home-1280.png)、[768](evidence/epic-0005/ac1-home-768.png)、[375](evidence/epic-0005/ac1-home-375.png)；失敗の巻き戻し [1280](evidence/epic-0005/ac1-failure-rolled-back-1280.png)、[768](evidence/epic-0005/ac1-failure-rolled-back-768.png)、[375](evidence/epic-0005/ac1-failure-rolled-back-375.png) |
| AC-2 | A がさらに C・D もフォローして（UI）ホームを開き、スクロール。失敗の経路として、次ページの Server Action を `abort`。長いフィードとして、100 人をフォローする `demo` のホーム | PASS。最初に 12 件、末尾の手前で 24 件、30 件目まで続き（件数の推移 12 → 24 → 30）、重複 0、順序は DB の新着順と一致、最後に「ここまでです」が出て番兵は消える。次ページが失敗すると「通信に失敗しました」の案内が出て表示済みの 12 件は残り、「もう一度読み込む」で 24 → 30 件。`demo`（100 人をフォロー、1,000 件）も 12 件 → 24 件で重複なし。注: B・C・D の 3 人で 30 件（1 人 25 件以上ではない） | 最初の 12 件 [1280](evidence/epic-0005/ac2-first-12-1280.png)、[768](evidence/epic-0005/ac2-first-12-768.png)、[375](evidence/epic-0005/ac2-first-12-375.png)；24 件 [1280](evidence/epic-0005/ac2-second-24-1280.png)、[768](evidence/epic-0005/ac2-second-24-768.png)、[375](evidence/epic-0005/ac2-second-24-375.png)；末尾 [1280](evidence/epic-0005/ac2-end-1280.png)、[768](evidence/epic-0005/ac2-end-768.png)、[375](evidence/epic-0005/ac2-end-375.png)；失敗 [1280](evidence/epic-0005/ac2-failure-alert-1280.png)、[768](evidence/epic-0005/ac2-failure-alert-768.png)、[375](evidence/epic-0005/ac2-failure-alert-375.png) |
| AC-3 | A が B のプロフィールで「フォロー中」を押して解除し、再読み込み、ホームを開き直す。失敗の経路として、C の解除で通信を `abort` | PASS。「フォローする」に戻り、フォロワー数は 21 → 20。再読み込みしても同じ。ホームに B の投稿は無く（C・D の 20 件だけ。最後まで進んで B は 0 件）。解除の通信が失敗すると、案内が出て「フォロー中」・21 のまま | 解除後 [1280](evidence/epic-0005/ac3-unfollowed-1280.png)、[768](evidence/epic-0005/ac3-unfollowed-768.png)、[375](evidence/epic-0005/ac3-unfollowed-375.png)；ホーム [1280](evidence/epic-0005/ac3-home-1280.png)、[768](evidence/epic-0005/ac3-home-768.png)、[375](evidence/epic-0005/ac3-home-375.png)；失敗の巻き戻し [1280](evidence/epic-0005/ac3-failure-rolled-back-1280.png)、[768](evidence/epic-0005/ac3-failure-rolled-back-768.png)、[375](evidence/epic-0005/ac3-failure-rolled-back-375.png) |
| AC-4 | B（A がフォロー中でフォロワー 21 人）のヘッダーの「21 フォロワー」を開き、スクロール。`demo` の「100 フォロー中」を開く。失敗・空の経路として、フォロワーも誰もフォローしていない利用者の一覧、存在しない利用者の一覧 | PASS。フォロワー一覧は 20 件で、A（`試験 A`）が一覧にある（並びは DB の新着順と一致）。末尾までスクロールすると 21 件目が出て重複なし。フォロー中一覧（`demo`、100 人）は 20 件、スクロールで 40 件。空の一覧は「まだフォロワーはいません」「まだ誰もフォローしていません」。存在しない利用者の一覧は HTTP 404 | ヘッダー [1280](evidence/epic-0005/ac4-profile-header-1280.png)、[768](evidence/epic-0005/ac4-profile-header-768.png)、[375](evidence/epic-0005/ac4-profile-header-375.png)；フォロワー 20 件 [1280](evidence/epic-0005/ac4-followers-20-1280.png)、[768](evidence/epic-0005/ac4-followers-20-768.png)、[375](evidence/epic-0005/ac4-followers-20-375.png)；21 件 [1280](evidence/epic-0005/ac4-followers-21-1280.png)、[768](evidence/epic-0005/ac4-followers-21-768.png)、[375](evidence/epic-0005/ac4-followers-21-375.png)；フォロー中 [1280](evidence/epic-0005/ac4-following-20-then-more-1280.png)、[768](evidence/epic-0005/ac4-following-20-then-more-768.png)、[375](evidence/epic-0005/ac4-following-20-then-more-375.png)；空 [1280](evidence/epic-0005/ac4-empty-followers-1280.png)、[768](evidence/epic-0005/ac4-empty-followers-768.png)、[375](evidence/epic-0005/ac4-empty-followers-375.png) |
| AC-5 | ログアウト中に `/` を開き、B のプロフィールの「フォローする」を押す。A が自分のプロフィールを開く | PASS。`/` は `/accounts/login` へ移る。ログアウト中の「フォローする」は `/accounts/login` へのリンクで、押すとログイン画面へ。自分のプロフィールにフォローボタンは 0 個で、「プロフィールを編集」が 1 個 | ログアウト中の / [1280](evidence/epic-0005/ac5-logged-out-home-1280.png)、[768](evidence/epic-0005/ac5-logged-out-home-768.png)、[375](evidence/epic-0005/ac5-logged-out-home-375.png)；自分のプロフィール [1280](evidence/epic-0005/ac5-own-profile-1280.png)、[768](evidence/epic-0005/ac5-own-profile-768.png)、[375](evidence/epic-0005/ac5-own-profile-375.png) |
| AC-6 | フォロー 0 人の新規利用者 E でホームを開く。失敗の経路として、投稿・エラーの案内が出ないこと | PASS。「フォローすると、その人の投稿がここに表示されます」が 1 件、投稿 0 件、「通信に失敗しました」の案内 0 件 | 空のフィード [1280](evidence/epic-0005/ac6-empty-feed-1280.png)、[768](evidence/epic-0005/ac6-empty-feed-768.png)、[375](evidence/epic-0005/ac6-empty-feed-375.png) |
| AC-7 | 3 幅で、上の操作の全画面（フォロワー一覧・フォロー中一覧・自分と他人のプロフィール・空のホーム・フィードのあるホーム）に axe（`@axe-core/playwright`）。コンソールと通信。Tab・Enter・Space だけでフォロー・解除 | PASS。axe は 7 画面 × 3 幅 = 21 回で、違反（重大・深刻に限らず全て）が 0 件。コンソールのエラー・警告と失敗した通信は、試験のために起こした失敗（下の表）を除いて 0。Tab で「フォローする」に届き、Enter で「フォロー中」（`aria-pressed=true`）、Space で戻る。DB の行も同じ | キーボード操作 [1280](evidence/epic-0005/ac7-keyboard-profile-1280.png)、[768](evidence/epic-0005/ac7-keyboard-profile-768.png)、[375](evidence/epic-0005/ac7-keyboard-profile-375.png) |

### キーボードで届くか

[summary.json](evidence/epic-0005/summary.json) の `tabOrder`（1280px）。フォロワー一覧: 本文へ移動 → 下のナビ（ホーム・検索・投稿・通知・プロフィール）→ 見出しの `@seed_user_132` → 一覧の 20 人（行ごとのリンク）→ 先頭へ。プロフィール: ナビ → 「フォローする」→ 「19 フォロワー」→ 「9 フォロー中」→ 投稿のグリッド。ホームのフィード: ナビ → 作者 → いいね → 件数 → コメント → 「コメント N 件をすべて見る」を投稿ごとに。空のホーム: ナビだけ。どの画面も、新しい操作の部品に Tab で届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0005/summary.json) の `health`。出来事があった手順だけが非ゼロ）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ 2 人・`demo` のログイン、B・C・D・K・自分のプロフィール、フォロー・解除、ホーム（12・24・30 件の読み込み）、フォロワー一覧・フォロー中一覧、空のホーム、ログアウト中の `/` | 0 | 0 |
| AC-1 の失敗の経路（C のフォローの POST を `abort`） | `Failed to load resource: net::ERR_FAILED` 1 件（起こした失敗） | POST 1 件（`abort`） |
| AC-2 の失敗の経路（次ページの POST を `abort`） | 同 1 件 | POST 1 件（`abort`） |
| AC-3 の失敗の経路（解除の POST を `abort`） | 同 1 件 | POST 1 件（`abort`） |
| 存在しない利用者のプロフィールと一覧（AC-1・AC-4 の失敗の経路） | `Failed to load resource: 404` 各 1 件 | 404 応答 各 1 件（想定の応答） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3104 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして。`uptime` の load は 8 前後）。typecheck・lint・format・docs・unit（385）・integration（226、4 件は想定の skip）・build・e2e（117 件。子 PBI の `follow.spec.ts`・`feed.spec.ts` を含む）が全て OK。記録: [verify.txt](evidence/epic-0005/verify.txt) | 0 |
| 同（1 回目。スロットに `seed:bench` の 1,000 人分が残ったままだった） | 1（`e2e/seed.spec.ts` の `beforeAll` が 120 秒で時間切れ。スロットを空にした 2 回目で解消。製品の不具合ではない。`get-feed.perf.int.test.ts` の既知の不安定な試験は 2 回とも通った） |

## 見つけた問題

なし。

（気づき。製品の不具合ではなく、AC の判定にも影響しない）`seed:bench` の `follows.created_at` は、試験の日時より先（2026-11-24〜2027-01-02）の値を含む。フォロワー一覧は新着順（`created_at` の降順）のため、いま A がフォローした行は先頭ではなく 12 番目に出る（並びは DB の新着順と一致）。シードの日時の取り方の問題で、実際の利用では起きない。
