---
type: TestReport
title: EPIC #10 発見の総合試験（1 回目）
description: 統合ブランチ m3/phase2 の dd2bdeb で、EPIC #10 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。全て満たし、コンソールの警告・エラーと失敗した通信は 0（失敗の経路のために起こした分を除く）で、PASS。
tags: [epic-test]
---

# EPIC #10 発見の総合試験（1 回目）

## 対象

- EPIC: [#10](https://github.com/ohta-rh/insta-modoki/issues/10)（子 PBI #48 ユーザー検索・#49 ハッシュタグ・#57 発見タブ）
- 試験した commit: `dd2bdeb`（統合ブランチ `m3/phase2`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-22
- スロット: 2（アプリ `http://localhost:3102`、`pnpm build` → `PORT=3102 pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local`、バケット `insta-s2`、`slot reset 2` で空にしてから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データ: 利用者の流れが AC の中身のところ（A のサインアップ、投稿 5 件の作成と投稿詳細・タグのリンク、A による `e10_fol` のフォロー）は UI で作った。AC-3 の「7 日前ちょうど・8 日前」の投稿、フォロー外の作者、いいね（最大 50 件ずつ）、検索用の利用者 8 人は、アプリ自身の E2E ハーネス `/e2e-harness/db`（`seedUser`・`insertPost`・`seedLikers`）で入れた（ADR-0041。D1 への直接の書き込みはしていない。読み取りは `node:sqlite`）。写真の実体はハーネスの行ごとに Garage へ置いた。パスワードは実行時に生成し、どこにも書いていない。
- 試験は 2 回流した。1 回目は試験の手順の誤り 2 件（空白だけの入力で出る文言を「エラーの案内」と想定していた。Escape で閉じた後に同じ値を入れ直して候補が再び開くと想定していた）で落ち、スロットを空にして最初からやり直した。ここに載せるのは 2 回目の結果。
- 項目ごとのデータと axe・Tab の順・ブラウザの状態: [summary.json](evidence/epic-0010/summary.json)

## 結果

PASS。AC-1〜AC-5 を全て満たした。コンソールのエラー・警告と失敗した通信は、失敗の経路のために起こした分を除いて 0。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 利用者 `haru`（表示名 Haru）・`hana`・`shiori`（表示名 Haru Fan）・`mio` ほかを用意し、`/explore/search` で「ha」と入力、候補から `haru` を押す。`%` `_` `\` を含む入力。失敗の経路として、一致なし・空白だけ+Enter・31 字 | PASS。候補は `hana`・`haru`・`shiori`（表示名の部分一致）で `mio` は出ない。`haru` を押すと `/haru` に移る。「100%」は表示名が `100%` の 1 人だけ、「%」も同じ 1 人だけ（全員にならない）、「a_」は `a_b` だけで `axb` は出ない、「_」は名前か表示名に `_` を含む 3 人だけ、「\」は 0 件で「「\」に一致するユーザーはいません」。一致なしは「「zzqqxx」に一致するユーザーはいません」。空白だけで Enter は検索せず、候補なし・案内「ユーザー名で検索」のまま（エラーは出ない）。31 字は入力欄が 30 字で止まる | 空の検索 [1280](evidence/epic-0010/ac1-search-empty-1280.png)、[768](evidence/epic-0010/ac1-search-empty-768.png)、[375](evidence/epic-0010/ac1-search-empty-375.png)、「ha」の候補 [1280](evidence/epic-0010/ac1-ha-candidates-1280.png)、[768](evidence/epic-0010/ac1-ha-candidates-768.png)、[375](evidence/epic-0010/ac1-ha-candidates-375.png)、選んだ後の /haru [1280](evidence/epic-0010/ac1-haru-profile-1280.png)、[768](evidence/epic-0010/ac1-haru-profile-768.png)、[375](evidence/epic-0010/ac1-haru-profile-375.png)、「100%」 [1280](evidence/epic-0010/ac1-percent-100pct-1280.png)、[768](evidence/epic-0010/ac1-percent-100pct-768.png)、[375](evidence/epic-0010/ac1-percent-100pct-375.png)、「%」 [1280](evidence/epic-0010/ac1-percent-only-1280.png)、[768](evidence/epic-0010/ac1-percent-only-768.png)、[375](evidence/epic-0010/ac1-percent-only-375.png)、「a_」 [1280](evidence/epic-0010/ac1-underscore-a_-1280.png)、[768](evidence/epic-0010/ac1-underscore-a_-768.png)、[375](evidence/epic-0010/ac1-underscore-a_-375.png)、「\」 [1280](evidence/epic-0010/ac1-backslash-none-1280.png)、[768](evidence/epic-0010/ac1-backslash-none-768.png)、[375](evidence/epic-0010/ac1-backslash-none-375.png)、一致なし [1280](evidence/epic-0010/ac1-nomatch-1280.png)、[768](evidence/epic-0010/ac1-nomatch-768.png)、[375](evidence/epic-0010/ac1-nomatch-375.png)、空白+Enter [1280](evidence/epic-0010/ac1-empty-query-1280.png)、[768](evidence/epic-0010/ac1-empty-query-768.png)、[375](evidence/epic-0010/ac1-empty-query-375.png)、31 字 [1280](evidence/epic-0010/ac1-too-long-1280.png)、[768](evidence/epic-0010/ac1-too-long-768.png)、[375](evidence/epic-0010/ac1-too-long-375.png) |
| AC-2 | A が UI で「朝の散歩 #Tokyo」「昼ごはん #TOKYO #cafe」「夜景 #ＴＯＫＹＯ」「別の街 #osaka」を投稿し、`#Tokyo` の投稿詳細で `#Tokyo` を押す。`#TOKYO`・`#ＴＯＫＹＯ` のリンクも押す。`/explore/tags/TOKYO`・`/explore/tags/Tokyo`・全角の URL を直接開く。失敗の経路として、投稿の無いタグ・空白入りのタグ。全角の `＃`（設計で対象外） | PASS。`#Tokyo` は `/explore/tags/tokyo` に移り、見出し「#tokyo」「投稿 3 件」、並びは新しい順（C → B → A）。`#TOKYO`・`#ＴＯＫＹＯ` のリンクも同じ URL。直接開く 3 通りも HTTP 200 で同じ 3 件・同じ順。`#osaka` は osaka の 1 件だけで tokyo に混ざらない。投稿前の `/explore/tags/tokyo` と空白入りのタグは HTTP 404（「ページが見つかりません」）。全角の `＃tokyo` はリンクにならない（#49 の決めどおり印は半角の `#` だけ） | 投稿前の /explore/tags/tokyo（404） [1280](evidence/epic-0010/ac2-unknown-tag-404-1280.png)、[768](evidence/epic-0010/ac2-unknown-tag-404-768.png)、[375](evidence/epic-0010/ac2-unknown-tag-404-375.png)、投稿詳細のキャプション [1280](evidence/epic-0010/ac2-post-detail-caption-1280.png)、[768](evidence/epic-0010/ac2-post-detail-caption-768.png)、[375](evidence/epic-0010/ac2-post-detail-caption-375.png)、全角のタグ [1280](evidence/epic-0010/ac2-post-detail-fullwidth-1280.png)、[768](evidence/epic-0010/ac2-post-detail-fullwidth-768.png)、[375](evidence/epic-0010/ac2-post-detail-fullwidth-375.png)、タグのページ [1280](evidence/epic-0010/ac2-tag-tokyo-1280.png)、[768](evidence/epic-0010/ac2-tag-tokyo-768.png)、[375](evidence/epic-0010/ac2-tag-tokyo-375.png)、#osaka [1280](evidence/epic-0010/ac2-tag-osaka-1280.png)、[768](evidence/epic-0010/ac2-tag-osaka-768.png)、[375](evidence/epic-0010/ac2-tag-osaka-375.png)、空白入りのタグ（404） [1280](evidence/epic-0010/ac2-bad-tag-404-1280.png)、[768](evidence/epic-0010/ac2-bad-tag-404-768.png)、[375](evidence/epic-0010/ac2-bad-tag-404-375.png) |
| AC-3 | 空のスロットで発見タブを開く。その後、フォロー外の人気の投稿（いいね 30・12・5）、7 日前まであと 10 分（いいね 5）、7 日前の同時刻（40）、8 日前（50）、自分の投稿（45）、A がフォローした `e10_fol` の投稿（35）、いいね 1 の 24 件を入れ、A が `e10_fol` を UI でフォローして `/explore` を開き、最後まで読む。失敗の経路として、続きの通信を `abort` | PASS。空のスロットでは「まだ人気の投稿がありません」。データを入れた後は、上位がいいね 30 → 12 → 5 の順、1 ページ目 24 件・続きで計 27 件（重複 0）。8 日前の投稿・自分の投稿・フォロー中の人の投稿は 27 件のどこにも無い。1 番目のタイルは 30 いいねの投稿を開き、戻ると `/explore`。続きの通信を落とすと「読み込めませんでした」「もう一度読み込む」が出て 24 件のまま。（気づき）「7 日前の同時刻」の投稿は、`asOf` が要求の時刻で挿入の数秒後のため、窓の外になり出ない。7 日前ちょうどの境界は `list-explore-posts.int.test.ts` が固定の `now` で確かめる | 空の発見 [1280](evidence/epic-0010/ac3-empty-1280.png)、[768](evidence/epic-0010/ac3-empty-768.png)、[375](evidence/epic-0010/ac3-empty-375.png)、上位 [1280](evidence/epic-0010/ac3-explore-top-1280.png)、[768](evidence/epic-0010/ac3-explore-top-768.png)、[375](evidence/epic-0010/ac3-explore-top-375.png)、2 ページ目まで [1280](evidence/epic-0010/ac3-explore-all-bottom-1280.png)、[768](evidence/epic-0010/ac3-explore-all-bottom-768.png)、[375](evidence/epic-0010/ac3-explore-all-bottom-375.png)、1 番目を開く [1280](evidence/epic-0010/ac3-tile-opened-1280.png)、[768](evidence/epic-0010/ac3-tile-opened-768.png)、[375](evidence/epic-0010/ac3-tile-opened-375.png)、続きの失敗 [1280](evidence/epic-0010/ac3-loadmore-failed-1280.png)、[768](evidence/epic-0010/ac3-loadmore-failed-768.png)、[375](evidence/epic-0010/ac3-loadmore-failed-375.png) |
| AC-4 | 未ログインの新しい文脈で `/explore`・`/explore/search`・`/explore/tags/tokyo`、さらに `/explore/search?q=ha` と全角のタグの URL を開く | PASS。5 つとも `/accounts/login` に移る | /explore [1280](evidence/epic-0010/ac4-explore-redirect-1280.png)、[768](evidence/epic-0010/ac4-explore-redirect-768.png)、[375](evidence/epic-0010/ac4-explore-redirect-375.png)、/explore/search [1280](evidence/epic-0010/ac4-search-redirect-1280.png)、[768](evidence/epic-0010/ac4-search-redirect-768.png)、[375](evidence/epic-0010/ac4-search-redirect-375.png)、/explore/tags/tokyo [1280](evidence/epic-0010/ac4-tag-redirect-1280.png)、[768](evidence/epic-0010/ac4-tag-redirect-768.png)、[375](evidence/epic-0010/ac4-tag-redirect-375.png) |
| AC-5 | キーボードだけで、検索の入力欄に Tab で入り「ha」→ ↓ ↓ ↑ → Enter、Escape、投稿詳細の `#Tokyo` に Tab → Enter、発見のグリッドの 2 番目のタイルと「ユーザーを検索」に Tab → Enter、「さらに表示」に Tab → Enter（スクロール検知を無効にして）。axe（`@axe-core/playwright`、WCAG 2.2 AA のタグ）を 4 画面 × 2 幅（1280・375） | PASS。↓ で候補が 1 番目 → 2 番目、↑ で 1 番目に戻る（`aria-activedescendant`）。Enter で選んだ `hana` のプロフィール（`/hana`）に移り、Escape で候補が閉じる。`#Tokyo` へは 13 回の Tab で届き Enter で `/explore/tags/tokyo`。2 番目のタイル（2 番目にいいねが多い投稿）・検索のリンク・「さらに表示」（27 件になる）も Tab と Enter で操作できる。axe は検索（候補つき）・タグのページ・投稿詳細・発見の 4 画面 × 2 幅で、重大・深刻（全ての違反でも）0 件 | 矢印で選択中 [1280](evidence/epic-0010/ac5-search-arrow-active-1280.png)、[768](evidence/epic-0010/ac5-search-arrow-active-768.png)、[375](evidence/epic-0010/ac5-search-arrow-active-375.png)、タグのリンクに focus [1280](evidence/epic-0010/ac5-tag-link-focused-1280.png)、[768](evidence/epic-0010/ac5-tag-link-focused-768.png)、[375](evidence/epic-0010/ac5-tag-link-focused-375.png)、グリッドのタイルに focus [1280](evidence/epic-0010/ac5-explore-tile-focused-1280.png)、[768](evidence/epic-0010/ac5-explore-tile-focused-768.png)、[375](evidence/epic-0010/ac5-explore-tile-focused-375.png) |

### キーボードで届くか

[summary.json](evidence/epic-0010/summary.json) の `tabOrder`（1280px）。検索: 本文へ移動 → 下のナビ（ホーム・検索・投稿・通知・プロフィール）→ 検索の入力欄。タグのページ・発見: ナビ → （発見は「ユーザーを検索」）→ グリッドのタイルを 1 件ずつ。どの画面も、新しい操作の部品に Tab で届く。

## ブラウザの状態

全ての画面と手順で、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0010/summary.json) の `health`。出来事があった手順だけが非ゼロ）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| 未ログインの 5 つの URL のログインへの移動、サインアップ、検索（候補・`%`・`_`・`\`・一致なし・空白・31 字）、プロフィール、タグのページ（3 通りの綴り・osaka）、投稿 5 件の作成と詳細、発見（空・27 件・タイルを開く）、キーボードの操作と axe | 0 | 0 |
| AC-2 の失敗の経路（投稿前の `/explore/tags/tokyo`） | `Failed to load resource: 404` 1 件（想定の応答） | 404 応答 1 件 |
| AC-2 の失敗の経路（空白入りのタグ `/explore/tags/a%20b`） | 同 1 件 | 404 応答 1 件 |
| AC-3 の失敗の経路（続きの POST を `abort`） | `Failed to load resource: net::ERR_FAILED` 1 件（起こした失敗） | POST 1 件（`abort`） |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3102 node scripts/verify.mjs`（アプリのサーバーを止め、スロットを空にして）。typecheck・lint・format・docs・unit（513）・integration（311、4 件は想定の skip）・build・e2e（186 件）・perf-budget が全て OK。 記録: [verify.txt](evidence/epic-0010/verify.txt)。子 PBI の `e2e/search-user.spec.ts`・`e2e/hashtag.spec.ts`・`e2e/explore.spec.ts` を含む | 0 |

## 見つけた問題

なし。

（気づき。製品の不具合ではなく、AC の判定にも影響しない）
- 全角の `＃` は、#49 の決めどおりタグの印にならない。AC-2 の「全角で書いたタグ」は、全角の文字で書いたタグ（`#ＴＯＫＹＯ`）として確かめた。
- 7 日前の同時刻の投稿は、画面を開いた時刻が挿入より後になるため窓の外になる。境界の「含む」は結合テストが固定の `now` で確かめる。
