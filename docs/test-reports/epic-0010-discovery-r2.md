---
type: TestReport
title: EPIC #10 発見の総合試験（2 回目）
description: 統合ブランチ m3/phase2 の 80aa192 で、EPIC #10 の 5 つの受け入れ条件を実ブラウザ（Google Chrome）で再び確かめた。ナビの未読バッジ（#86）・保存ボタン（#51）が入ったあとでも全て満たし、PASS。
tags: [epic-test]
---

# EPIC #10 発見の総合試験（2 回目）

## 対象

- EPIC: [#10](https://github.com/ohta-rh/insta-modoki/issues/10)（子 PBI #48 ユーザー検索・#49 ハッシュタグ・#57 発見タブ）。[1 回目](epic-0010-discovery.md)（`dd2bdeb`、PASS）のあとに、ナビの未読バッジ（#50・#58・#86）と投稿カードの保存ボタン（#51）などが入ったため、[ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md) により再試験した。
- 試験した commit: `80aa192`（統合ブランチ `m3/phase2`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 1（`http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、`slot reset 1` で空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Chrome を CDP で操作した。幅は 1280（高さ 900）・768（1024）・375（812）。
- データ: サインアップ・投稿 5 件・タグのリンク・フォローは UI で作った。未読の通知は、別の利用者 `epic10_b` が UI で A の投稿に「いいね」して作った（#86 の場合）。7 日前・8 日前の投稿、フォロー外の作者、いいね、検索用の利用者は、アプリ自身の E2E ハーネス `/e2e-harness/db` で入れた（ADR-0041）。パスワードは実行時に生成し、どこにも書いていない。
- 項目ごとのデータ・axe・ブラウザの状態: [summary.json](evidence/epic-0010-r2/summary.json)。試験は 1 回で通った。

## 結果

PASS。AC-1〜AC-5 を全て満たした。コンソールのエラー・警告と失敗した通信は、失敗の経路のために起こした分と通知の SSE の中断を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 利用者 `haru`（Haru）・`hana`・`shiori`（Haru Fan）・`a_b`・`axb`・表示名 `100%` の利用者・`mio` を用意し、`/explore/search` で「ha」を入力して `haru` を選ぶ。`100%`・`%`・`a_`・`_`・`\` を入力。失敗の経路: 一致なし・空白だけ+Enter・31 字 | PASS。候補は `hana`・`haru`・`shiori` で `mio` は出ず、`haru` を選ぶと `/haru` に移る。「100%」と「%」は表示名が `100%` の 1 人だけ（全員にならない）、「a_」は `a_b` だけで `axb` は出ない、「_」は `_` を含む名前だけ、「\」は 0 件。一致なしは「一致するユーザーはいません」、空白+Enter は検索せずエラーも出ない、31 字は 30 字で止まる | 空 [1280](evidence/epic-0010-r2/ac1-search-empty-1280.png)、[768](evidence/epic-0010-r2/ac1-search-empty-768.png)、[375](evidence/epic-0010-r2/ac1-search-empty-375.png)、「ha」 [1280](evidence/epic-0010-r2/ac1-ha-candidates-1280.png)、[768](evidence/epic-0010-r2/ac1-ha-candidates-768.png)、[375](evidence/epic-0010-r2/ac1-ha-candidates-375.png)、/haru [1280](evidence/epic-0010-r2/ac1-haru-profile-1280.png)、[768](evidence/epic-0010-r2/ac1-haru-profile-768.png)、[375](evidence/epic-0010-r2/ac1-haru-profile-375.png)、100% [1280](evidence/epic-0010-r2/ac1-percent-100pct-1280.png)、[768](evidence/epic-0010-r2/ac1-percent-100pct-768.png)、[375](evidence/epic-0010-r2/ac1-percent-100pct-375.png)、% [1280](evidence/epic-0010-r2/ac1-percent-only-1280.png)、[768](evidence/epic-0010-r2/ac1-percent-only-768.png)、[375](evidence/epic-0010-r2/ac1-percent-only-375.png)、a_ [1280](evidence/epic-0010-r2/ac1-underscore-a_-1280.png)、[768](evidence/epic-0010-r2/ac1-underscore-a_-768.png)、[375](evidence/epic-0010-r2/ac1-underscore-a_-375.png)、\\ [1280](evidence/epic-0010-r2/ac1-backslash-none-1280.png)、[768](evidence/epic-0010-r2/ac1-backslash-none-768.png)、[375](evidence/epic-0010-r2/ac1-backslash-none-375.png)、一致なし [1280](evidence/epic-0010-r2/ac1-nomatch-1280.png)、[768](evidence/epic-0010-r2/ac1-nomatch-768.png)、[375](evidence/epic-0010-r2/ac1-nomatch-375.png)、空白+Enter [1280](evidence/epic-0010-r2/ac1-empty-query-1280.png)、[768](evidence/epic-0010-r2/ac1-empty-query-768.png)、[375](evidence/epic-0010-r2/ac1-empty-query-375.png)、31 字 [1280](evidence/epic-0010-r2/ac1-too-long-1280.png)、[768](evidence/epic-0010-r2/ac1-too-long-768.png)、[375](evidence/epic-0010-r2/ac1-too-long-375.png) |
| AC-2 | A が UI で「朝の散歩 #Tokyo」「昼ごはん #TOKYO #cafe」「夜景 #ＴＯＫＹＯ」「別の街 #osaka」と全角の `＃tokyo` を含む投稿を作り、投稿詳細で `#Tokyo`・`#TOKYO`・`#ＴＯＫＹＯ` を押す。`/explore/tags/` の 3 通りの綴りを直接開く。失敗の経路: 投稿前のタグ・空白入りのタグ | PASS。いずれも `/explore/tags/tokyo` に移り、同じ 3 件が新しい順（C → B → A）。直接開く 3 通りも同じ一覧。osaka は 1 件だけで tokyo に混ざらない。投稿前のタグと空白入りは 404。全角の `＃` はリンクにならない（#49 の決めどおり） | 投稿前 404 [1280](evidence/epic-0010-r2/ac2-unknown-tag-404-1280.png)、[768](evidence/epic-0010-r2/ac2-unknown-tag-404-768.png)、[375](evidence/epic-0010-r2/ac2-unknown-tag-404-375.png)、投稿詳細 [1280](evidence/epic-0010-r2/ac2-post-detail-caption-1280.png)、[768](evidence/epic-0010-r2/ac2-post-detail-caption-768.png)、[375](evidence/epic-0010-r2/ac2-post-detail-caption-375.png)、全角 [1280](evidence/epic-0010-r2/ac2-post-detail-fullwidth-1280.png)、[768](evidence/epic-0010-r2/ac2-post-detail-fullwidth-768.png)、[375](evidence/epic-0010-r2/ac2-post-detail-fullwidth-375.png)、タグのページ [1280](evidence/epic-0010-r2/ac2-tag-tokyo-1280.png)、[768](evidence/epic-0010-r2/ac2-tag-tokyo-768.png)、[375](evidence/epic-0010-r2/ac2-tag-tokyo-375.png)、osaka [1280](evidence/epic-0010-r2/ac2-tag-osaka-1280.png)、[768](evidence/epic-0010-r2/ac2-tag-osaka-768.png)、[375](evidence/epic-0010-r2/ac2-tag-osaka-375.png)、空白入り 404 [1280](evidence/epic-0010-r2/ac2-bad-tag-404-1280.png)、[768](evidence/epic-0010-r2/ac2-bad-tag-404-768.png)、[375](evidence/epic-0010-r2/ac2-bad-tag-404-375.png) |
| AC-3 | 空のスロットで `/explore`。ハーネスで、フォロー外の人気の投稿（いいね 30・12・5）、7 日前まであと 10 分（5）、8 日前（50）、自分（45）、A がフォローした人（35）、いいね 1 の 24 件を入れて開き、最後まで読む。失敗の経路: 空・続きの通信を abort | PASS。空は「まだ人気の投稿がありません」。上位は 30 → 12 → 5 の順、1 ページ目 24 件・続きで 27 件（重複 0）。8 日前・自分・フォロー中の人の投稿は無い。1 番目のタイルは 30 いいねの投稿を開き、戻ると `/explore`。続きの失敗は「読み込めませんでした」「もう一度読み込む」で 24 件のまま | 空 [1280](evidence/epic-0010-r2/ac3-empty-1280.png)、[768](evidence/epic-0010-r2/ac3-empty-768.png)、[375](evidence/epic-0010-r2/ac3-empty-375.png)、上位 [1280](evidence/epic-0010-r2/ac3-explore-top-1280.png)、[768](evidence/epic-0010-r2/ac3-explore-top-768.png)、[375](evidence/epic-0010-r2/ac3-explore-top-375.png)、27 件 [1280](evidence/epic-0010-r2/ac3-explore-all-bottom-1280.png)、[768](evidence/epic-0010-r2/ac3-explore-all-bottom-768.png)、[375](evidence/epic-0010-r2/ac3-explore-all-bottom-375.png)、タイルを開く [1280](evidence/epic-0010-r2/ac3-tile-opened-1280.png)、[768](evidence/epic-0010-r2/ac3-tile-opened-768.png)、[375](evidence/epic-0010-r2/ac3-tile-opened-375.png)、続きの失敗 [1280](evidence/epic-0010-r2/ac3-loadmore-failed-1280.png)、[768](evidence/epic-0010-r2/ac3-loadmore-failed-768.png)、[375](evidence/epic-0010-r2/ac3-loadmore-failed-375.png) |
| AC-4 | 未ログインの新しい文脈で `/explore`・`/explore/search`・`/explore/tags/tokyo`、`/explore/search?q=ha`、全角のタグの URL を開く | PASS。5 つとも `/accounts/login` に移る | /explore [1280](evidence/epic-0010-r2/ac4-explore-redirect-1280.png)、[768](evidence/epic-0010-r2/ac4-explore-redirect-768.png)、[375](evidence/epic-0010-r2/ac4-explore-redirect-375.png)、/explore/search [1280](evidence/epic-0010-r2/ac4-search-redirect-1280.png)、[768](evidence/epic-0010-r2/ac4-search-redirect-768.png)、[375](evidence/epic-0010-r2/ac4-search-redirect-375.png)、/explore/tags/tokyo [1280](evidence/epic-0010-r2/ac4-tag-redirect-1280.png)、[768](evidence/epic-0010-r2/ac4-tag-redirect-768.png)、[375](evidence/epic-0010-r2/ac4-tag-redirect-375.png) |
| AC-5 | 通知が未読 1 件ある状態（#86）で、キーボードだけで検索（Tab → 「ha」→ ↓ ↓ ↑ → Enter、Escape）・投稿詳細の `#Tokyo`（Tab → Enter）・発見の 2 番目のタイルと「ユーザーを検索」（Tab → Enter）・「さらに表示」（Tab → Enter）。axe（WCAG 2.2 AA）を 5 画面 × 2 幅 | PASS。矢印で候補が動き（`aria-activedescendant`）、Enter で `hana` のプロフィールに移り、Escape で閉じる。他の操作も Tab と Enter だけでできる。axe は ホーム（保存ボタンつきの投稿カード）・検索（候補つき）・タグ・投稿詳細・発見の 5 画面 × 2 幅（1280・375）で違反 0 件（重大・深刻だけでなく全て）。どの画面でもナビの通知は「通知（未読 1 件）」で、バッジは通知の隣に出る | 矢印で選択中 [1280](evidence/epic-0010-r2/ac5-search-arrow-active-1280.png)、[768](evidence/epic-0010-r2/ac5-search-arrow-active-768.png)、[375](evidence/epic-0010-r2/ac5-search-arrow-active-375.png)、タグのリンク [1280](evidence/epic-0010-r2/ac5-tag-link-focused-1280.png)、[768](evidence/epic-0010-r2/ac5-tag-link-focused-768.png)、[375](evidence/epic-0010-r2/ac5-tag-link-focused-375.png)、タイル [1280](evidence/epic-0010-r2/ac5-explore-tile-focused-1280.png)、[768](evidence/epic-0010-r2/ac5-explore-tile-focused-768.png)、[375](evidence/epic-0010-r2/ac5-explore-tile-focused-375.png)、未読バッジ [1280](evidence/epic-0010-r2/unread-badge-nav-1280.png)、[768](evidence/epic-0010-r2/unread-badge-nav-768.png)、[375](evidence/epic-0010-r2/unread-badge-nav-375.png)、ホームの投稿カード [1280](evidence/epic-0010-r2/home-card-save-1280.png)、[768](evidence/epic-0010-r2/home-card-save-768.png)、[375](evidence/epic-0010-r2/home-card-save-375.png) |

### キーボードで届くか

[summary.json](evidence/epic-0010-r2/summary.json) の `tabOrder`（1280px）。どの画面も、新しい操作の部品（検索の入力欄・タグのリンク・グリッドのタイル・「ユーザーを検索」・「さらに表示」）に Tab で届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（`health`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| 未ログインの移動、サインアップ、検索の全ての入力、タグのページ（3 通りの綴り・osaka）、投稿 5 件の作成と詳細、未読の通知、ホーム、発見（空・27 件・タイルを開く）、キーボードの操作と axe | 0 | 0（通知の `GET /api/notifications/stream` が画面の移動で `net::ERR_ABORTED` になる分は想定どおり） |
| AC-2 の失敗の経路（投稿前の `/explore/tags/tokyo`、空白入りの `/explore/tags/a%20b`） | `Failed to load resource: 404` 各 1 件（想定の応答） | 404 応答 各 1 件 |
| AC-3 の失敗の経路（続きの POST を `abort`） | `net::ERR_FAILED` 1 件（起こした失敗） | POST 1 件（`abort`） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして）。typecheck・lint・format・docs・unit（590）・integration（370、4 件は想定の skip）・build・e2e（213 件）・perf-budget が全て OK。子 PBI の `e2e/search-user.spec.ts`・`e2e/hashtag.spec.ts`・`e2e/explore.spec.ts` を含む。記録: [verify.txt](evidence/epic-0010-r2/verify.txt) | 0 |

## 見つけた問題

なし。
