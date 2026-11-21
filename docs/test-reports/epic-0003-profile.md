---
type: TestReport
title: EPIC #3 プロフィールの総合試験（1 回目）
description: 統合ブランチ m1/local-mvp の 20d04dd で、EPIC #3 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。5 つとも満たし PASS。ただし AC-5 の「画像に空でない alt」はプロフィールのヘッダーのアイコンが alt="" で、文言どおりではない（Director の判断を求める）。
tags: [epic-test]
---

# EPIC #3 プロフィールの総合試験（1 回目）

## 対象

- EPIC: [#3](https://github.com/ohta-rh/insta-modoki/issues/3)（子 PBI #32 プロフィールの表示・#37 プロフィールの編集。#41 のグリッドからのモーダルと #42 のフォローも統合済みで、プロフィールに関わる）
- 試験した commit: `20d04dd`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-21
- スロット: 4（アプリ `http://localhost:3104`、`pnpm build` → `PORT=3104 pnpm start`）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データ: AC-1 の「投稿は DB に直接入れた行を使う」は [ADR-0041](../adr/0041-e2e-setup-writes-go-through-the-app.md) より前の書き方なので、アプリが動いている間に D1 を書かず、空のスロットで、利用者 A と B のサインアップと A の 3 件の投稿（写真 1 枚・代替テキスト・キャプション）を全て UI から作った（`pnpm seed:demo` も流したが、この試験では使っていない）。パスワードは実行時に生成し、どこにも書いていない。
- 項目ごとのデータ: [summary.json](evidence/epic-0003/summary.json)

## 結果

PASS。AC-1〜5 は実ブラウザで満たした。見つけた問題は 1 件（AC の文言と実装のずれ。軽い。「見つけた問題」）で、Director の判断で PASS のままにするか、バグの PBI にするかを決める。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 利用者 B で、UI から作った利用者 A（投稿 3 件、自己紹介あり）の `/<username>` を開く。次に存在しない名前を開く | PASS。ヘッダーに表示名「撮影者 A」・`@ユーザー名`・自己紹介・「3 投稿」「0 フォロワー」「0 フォロー中」。アイコンは未設定なので頭文字の丸。グリッドは 3 列で、タイルは正方形（1280px で 208.7×208.7、768px で 173.3×173.3、375px で 123.7×123.7）、間隔は 3 つの幅とも 2px。並びは新しい順（写真 3 → 2 → 1）。存在しない名前は状態 404 で「ページが見つかりません」。失敗の経路は 404 | [ac1-other-profile 1280](evidence/epic-0003/ac1-other-profile-1280.png)、[768](evidence/epic-0003/ac1-other-profile-768.png)、[375](evidence/epic-0003/ac1-other-profile-375.png)、[404 1280](evidence/epic-0003/ac1-404-1280.png)、[768](evidence/epic-0003/ac1-404-768.png)、[375](evidence/epic-0003/ac1-404-375.png) |
| AC-2 | B で `/accounts/edit` を開き、表示名を空にして（失敗の経路）、表示名「新しい名前 B 😀」・自己紹介 2 行・アイコン画像（800×600 の JPEG）に変えて保存。別のブラウザ（別の context、A の Cookie）で `/<B のユーザー名>` を開き、再読み込みだけ行う | PASS。表示名が空だと「表示名は 1〜30 字で入力してください」が出て保存ボタンが無効。保存後に B の `/<username>` へ移り、新しい表示名・自己紹介（改行を保つ）・新しいアイコン（Garage の画像）が出る。別の context でも再読み込みだけで同じ値が出て、アイコンは読み込めた（`naturalWidth > 0`）。編集のリンクは出ない | [空の表示名 1280](evidence/epic-0003/ac2-fail-empty-name-1280.png)、[768](evidence/epic-0003/ac2-fail-empty-name-768.png)、[375](evidence/epic-0003/ac2-fail-empty-name-375.png)、[入力後 1280](evidence/epic-0003/ac2-edit-filled-1280.png)、[768](evidence/epic-0003/ac2-edit-filled-768.png)、[375](evidence/epic-0003/ac2-edit-filled-375.png)、[保存後の自分 1280](evidence/epic-0003/ac2-own-after-1280.png)、[768](evidence/epic-0003/ac2-own-after-768.png)、[375](evidence/epic-0003/ac2-own-after-375.png)、[別の context 1280](evidence/epic-0003/ac2-other-view-1280.png)、[768](evidence/epic-0003/ac2-other-view-768.png)、[375](evidence/epic-0003/ac2-other-view-375.png) |
| AC-3 | 自己紹介に 151 字を入れて保存。次に 150 字を入れて保存 | PASS。151 字は「自己紹介は 150 字までです」と「151 / 150」が出て保存ボタンが無効。プロフィールを開き直しても元の自己紹介のまま（保存されていない）。150 字は警告が出ず保存でき、保存後のプロフィールの自己紹介は 150 字 | [151 字 1280](evidence/epic-0003/ac3-151-refused-1280.png)、[768](evidence/epic-0003/ac3-151-refused-768.png)、[375](evidence/epic-0003/ac3-151-refused-375.png)、[150 字 1280](evidence/epic-0003/ac3-150-saved-1280.png)、[768](evidence/epic-0003/ac3-150-saved-768.png)、[375](evidence/epic-0003/ac3-150-saved-375.png) |
| AC-4 | B で A のプロフィールを開く。B 自身のプロフィールも開く。未ログインの context で `/accounts/edit` を開く | PASS。A のプロフィール（B から・未ログインから）に「プロフィールを編集」は無い（リンクも文字も 0 件）。B 自身のプロフィールにはある。未ログインの `/accounts/edit` は `/accounts/login` に移る | [他人のプロフィール 1280](evidence/epic-0003/ac4-others-profile-1280.png)、[768](evidence/epic-0003/ac4-others-profile-768.png)、[375](evidence/epic-0003/ac4-others-profile-375.png)、[未ログインの編集 1280](evidence/epic-0003/ac4-anon-edit-to-login-1280.png)、[768](evidence/epic-0003/ac4-anon-edit-to-login-768.png)、[375](evidence/epic-0003/ac4-anon-edit-to-login-375.png) |
| AC-5 | 375px と 1280px で、プロフィールと編集の画面を Tab・文字入力・Enter だけで操作。画像の `alt`、コンソール、通信を調べる | PASS（条件あり。「見つけた問題」の 1 を Director が判断する）。両幅とも、プロフィールの全てのリンク・ボタンに Tab が届き、編集は表示名 → 自己紹介 → 保存（Enter）で保存して B のプロフィールへ戻れた。横のスクロールは無い。グリッドの画像は全て空でない `alt`（「撮影者 A の写真 N」）、編集画面のアイコンは「現在のアイコン」。プロフィールのヘッダーのアイコンだけ `alt=""`（隣に表示名がある装飾の扱い）。コンソールのエラー・警告と失敗した通信は、意図した 404 の画面を除き 0 | [プロフィール 1280](evidence/epic-0003/ac5-profile-keyboard-1280.png)・[375](evidence/epic-0003/ac5-profile-keyboard-375.png)、[編集 1280](evidence/epic-0003/ac5-edit-keyboard-1280.png)・[375](evidence/epic-0003/ac5-edit-keyboard-375.png) |

### AC-5 の Tab の順（[summary.json](evidence/epic-0003/summary.json) の `keyboard`）

| 画面 | 1280px | 375px |
|---|---|---|
| 他人のプロフィール | 本文へ移動 → ホーム・検索・投稿・通知・プロフィール（左のナビ）→ フォローする → フォロワー → フォロー中 → 写真 3 → 写真 2 → 写真 1 → 先頭へ戻る | 本文へ移動 → フォローする → フォロワー → フォロー中 → 写真 3 → 2 → 1 → ホーム・検索・投稿・通知・プロフィール（下のナビ）→ 先頭へ戻る |
| 編集 | 本文へ移動 → 左のナビ → アイコンの選択 → 表示名 → 自己紹介 → 保存（Enter で保存） | 本文へ移動 → アイコンの選択 → 表示名 → 自己紹介 → 保存（Enter で保存） |

## ブラウザの状態

全ての画面と手順を通して、コンソールのエラー・警告・`pageerror`・失敗した要求・状態 400 以上の応答を数えた。

| 画面 | コンソールのエラー・警告 | 失敗した要求・状態 400 以上 |
|---|---|---|
| 他人のプロフィール・自分のプロフィール（保存前後・別の context） | 0 | 0 |
| 編集（空の表示名・入力後・151 字・150 字・キーボード 375/1280） | 0 | 0 |
| `/accounts/edit`（未ログイン）→ ログイン | 0 | 0 |
| 存在しない名前の 404 | 1（「Failed to load resource: 404」。Chrome が 404 の応答に必ず出す） | 1（`/no_such_user_…` が 404。意図した結果） |

404 の画面を除く全ての手順は 0 だった（[summary.json](evidence/epic-0003/summary.json) の `events` は 404 の 2 件だけ）。

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3104 node scripts/verify.mjs`（スロット 4、アプリのサーバーを止めて実行。typecheck・lint・format・docs・unit（209 件）・integration・build・e2e（107 件）が全て OK。子 PBI の E2E `e2e/profile.spec.ts`・`e2e/profile-edit.spec.ts` と、#41 の `e2e/post-modal.spec.ts`・#42 の `e2e/follow.spec.ts` を含む）。[verify.txt](evidence/epic-0003/verify.txt) | 0 |

## 見つけた問題

1. 【軽い・AC の文言と実装のずれ】AC-5 は「画像に空でない `alt`」だが、プロフィールのヘッダーのアイコンは `<img alt="">`（`src/features/profile/ui/ProfileHeader.tsx`）。隣に表示名と `@ユーザー名` があるので装飾として空にする扱いで、WCAG では妥当。[#32](https://github.com/ohta-rh/insta-modoki/issues/32) の AC-4 が「空でない `alt`」を求めているのはグリッドの画像だけで、そちらは満たしている。再現: 利用者がアイコンを設定したあと `/<username>` を開き、`main header img` の `alt` を読む（`summary.json` の `alts.profileB`）。期待（AC の文言）: 空でない。実際: 空。Director の判断: AC を「情報を持つ画像」と読み替えて PASS とするか、`alt` を「<表示名> のアイコン」にするバグの PBI を立てる。
