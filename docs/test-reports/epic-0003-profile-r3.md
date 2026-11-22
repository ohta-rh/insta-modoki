---
type: TestReport
title: EPIC #3 プロフィールの総合試験（3 回目、PASS）
description: ADR-0048 によるやり直し。#80（ADR-0054）で編集画面のアイコンの入力がハイドレーション前に選んだファイルをマウント時に取り込むようになった後の 6abd584 で、EPIC #3 の 5 つの受け入れ条件と、JS を止めた状態・Slow 3G でのアイコン選択を実ブラウザ（Google Chrome 157）で確かめた。全て PASS。
tags: [epic-test]
---

# EPIC #3 プロフィールの総合試験（3 回目）

## 対象

- EPIC: [#3](https://github.com/ohta-rh/insta-modoki/issues/3)。[1 回目](epic-0003-profile.md)・[2 回目](epic-0003-profile-r2.md)は PASS。
- やり直しの理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。#80（commit `c3a4a8e`、[ADR-0054](../adr/0054-pick-up-files-chosen-before-hydration-on-mount.md)）が `src/features/profile/edit/AvatarField.tsx` に `useFilesPickedBeforeHydration` を足した。ハイドレーション前に選んだアイコンがマウント時に取り込まれる。
- 試験した commit: `6abd584`（ブランチ `epic-test/3`）
- 日付: 2026-11-22
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（別のセッションがプロファイルを握っている）。[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データ: リセットした空のスロットに、利用者 A（投稿 3 件）と B のサインアップ、全ての投稿・プロフィールの保存を UI から行った。パスワードは実行時に生成し、どこにも書いていない。
- 項目ごとのデータ: [summary.json](evidence/epic-0003-r3/summary.json)、実行の記録: [run.log](evidence/epic-0003-r3/run.log)
- 今回の範囲: 5 つの AC と #80 の重点（アイコン）。r2 で見たグリッドの無限スクロールとモーダルのフォーカスは、今回の変更（`AvatarField.tsx` と共有 hook）が触れないので再試験していない。

## 結果

PASS。AC-1〜5 は実ブラウザで満たした。重点の #80 も満たした。JS を止めた状態でも Slow 3G でも、ハイドレーション前にキーボードで選んだアイコンが、ハイドレーション後にプレビューへ入り、保存できた。10MB 超の失敗は理由を出し、選び直しは重複しなかった。コンソールの警告は 0。見つけた問題は無い。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | B で、UI から作った A（投稿 3 件、自己紹介あり）の `/<username>` を開く。次に存在しない名前を開く | PASS。ヘッダーに「撮影者 A」・`@ユーザー名`・自己紹介（改行を保つ）・「3 投稿」「0 フォロワー」「0 フォロー中」。グリッドは 3 列で、タイルは正方形（1280px で 208.7×208.7、768px で 173.3×173.3、375px で 123.7×123.7）、間隔は 3 幅とも 2px。並びは新しい順（写真 3 → 2 → 1）。存在しない名前は状態 404 で「ページが見つかりません」（失敗の経路） | [他人 1280](evidence/epic-0003-r3/ac1-other-profile-1280.png)・[768](evidence/epic-0003-r3/ac1-other-profile-768.png)・[375](evidence/epic-0003-r3/ac1-other-profile-375.png)、[404 1280](evidence/epic-0003-r3/ac1-404-1280.png)・[768](evidence/epic-0003-r3/ac1-404-768.png)・[375](evidence/epic-0003-r3/ac1-404-375.png) |
| AC-2 | B で `/accounts/edit` を開き、表示名を空にして（失敗の経路）、次に表示名「新しい名前 B 😀」・自己紹介 2 行・アイコン（800×600 の JPEG）を入れて保存。A の Cookie の別の context で `/<B>` を開き、再読み込みだけ行う | PASS。空の表示名は「表示名は 1〜30 字で入力してください」が出て保存ボタンが無効。保存すると B の `/<username>` へ移り、新しい表示名・自己紹介（2 行）・アイコン（Garage の画像、`naturalWidth` 320）が出る。別の context でも同じ値とアイコン（読み込めた）が出て、編集のリンクは無い | [空の表示名 1280](evidence/epic-0003-r3/ac2-fail-empty-name-1280.png)・[768](evidence/epic-0003-r3/ac2-fail-empty-name-768.png)・[375](evidence/epic-0003-r3/ac2-fail-empty-name-375.png)、[入力後 1280](evidence/epic-0003-r3/ac2-edit-filled-1280.png)・[768](evidence/epic-0003-r3/ac2-edit-filled-768.png)・[375](evidence/epic-0003-r3/ac2-edit-filled-375.png)、[保存後 1280](evidence/epic-0003-r3/ac2-own-after-1280.png)・[768](evidence/epic-0003-r3/ac2-own-after-768.png)・[375](evidence/epic-0003-r3/ac2-own-after-375.png)、[別の context 1280](evidence/epic-0003-r3/ac2-other-view-1280.png)・[768](evidence/epic-0003-r3/ac2-other-view-768.png)・[375](evidence/epic-0003-r3/ac2-other-view-375.png) |
| AC-3 | 自己紹介に 151 字を入れる。開き直す。次に 150 字を入れて保存 | PASS。151 字は「自己紹介は 150 字までです」が出て保存ボタンが無効。プロフィールを開き直しても保存されていない（前の自己紹介のまま）。150 字は警告が出ず保存でき、プロフィールに 150 字が出る | [151 字 1280](evidence/epic-0003-r3/ac3-151-refused-1280.png)・[768](evidence/epic-0003-r3/ac3-151-refused-768.png)・[375](evidence/epic-0003-r3/ac3-151-refused-375.png)、[150 字 1280](evidence/epic-0003-r3/ac3-150-saved-1280.png)・[768](evidence/epic-0003-r3/ac3-150-saved-768.png)・[375](evidence/epic-0003-r3/ac3-150-saved-375.png) |
| AC-4 | B で A のプロフィールを開く。未ログインの context でも開く。未ログインで `/accounts/edit` を開く。B 自身のプロフィールを開く | PASS。A のプロフィールに「プロフィールを編集」は無い（B からも未ログインからも 0 件）。未ログインの `/accounts/edit` は `/accounts/login` に移る。B 自身にはある | [他人 1280](evidence/epic-0003-r3/ac4-others-profile-1280.png)・[768](evidence/epic-0003-r3/ac4-others-profile-768.png)・[375](evidence/epic-0003-r3/ac4-others-profile-375.png)、[未ログインの編集 1280](evidence/epic-0003-r3/ac4-anon-edit-to-login-1280.png)・[768](evidence/epic-0003-r3/ac4-anon-edit-to-login-768.png)・[375](evidence/epic-0003-r3/ac4-anon-edit-to-login-375.png) |
| AC-5 | 375px と 1280px で、プロフィールと編集の画面を Tab・文字入力・Enter だけで操作。画像の `alt`、コンソール、通信を調べる | PASS。プロフィールは両幅とも全てのリンク・ボタンに Tab が届く。編集は（アイコンの選択 →）表示名 → 自己紹介 → 保存（Enter）で保存して戻れた（両幅）。横スクロールは無い。グリッドの写真は全て空でない `alt`（「撮影者 A の写真 N」）。ヘッダーのアイコンは `alt=""`（飾り。[1 回目の Director の判定](epic-0003-profile.md)と同じ）。コンソールと通信は、意図した 404 を除き 0 | [プロフィール 1280](evidence/epic-0003-r3/ac5-profile-keyboard-1280.png)・[375](evidence/epic-0003-r3/ac5-profile-keyboard-375.png)、[編集 1280](evidence/epic-0003-r3/ac5-edit-keyboard-1280.png)・[375](evidence/epic-0003-r3/ac5-edit-keyboard-375.png) |
| #80（重点）S1: JS を止めて選ぶ | `/accounts/edit` を、`/_next/static/*.js` を止めた状態で開く。Tab（6 回）でアイコンの入力に着き Enter でファイル選択を開き、赤の画像を選ぶ。JS を放して（ハイドレーション）、プレビューを見て、保存する | PASS。ハイドレーション前: プレビュー 0・入力の `files` 1・「現在のアイコン」表示のまま。ハイドレーション後: プレビュー 1 つ（`blob:`、読み込めた、中央の正方形 `150,0,600,600`）、「現在のアイコン」は消え、`alert` 0。1 秒後も 1 つのまま（二重に入らない）。保存すると B のプロフィールのアイコンが新しい画像（`naturalWidth` 320、src が変わった）になる | [前 1280](evidence/epic-0003-r3/h80-s1-before-hydration-1280.png)・[768](evidence/epic-0003-r3/h80-s1-before-hydration-768.png)・[375](evidence/epic-0003-r3/h80-s1-before-hydration-375.png)、[後 1280](evidence/epic-0003-r3/h80-s1-after-hydration-1280.png)・[768](evidence/epic-0003-r3/h80-s1-after-hydration-768.png)・[375](evidence/epic-0003-r3/h80-s1-after-hydration-375.png)、[保存後 1280](evidence/epic-0003-r3/h80-s1-saved-1280.png)・[768](evidence/epic-0003-r3/h80-s1-saved-768.png)・[375](evidence/epic-0003-r3/h80-s1-saved-375.png) |
| #80 S2: Slow 3G と選び直し | JS を止めて緑の画像を選び、500kbps・遅延 400ms（Slow 3G 相当）で JS を放す。ハイドレーション後、別の画像（青）を選び直し、同じ青をもう一度選び直し、保存する | PASS。ハイドレーションまで 9.3 秒かかった後、プレビュー 1 つ（`0,100,700,700`）、1 秒後も 1 つ。青を選び直すとプレビューは 1 つのまま青の `0,0,800,800` に替わり、同じ青をもう一度選んでも 1 つのまま（`change` が発火し、増えない）。保存でアイコンが替わる（`naturalWidth` 320） | [前 1280](evidence/epic-0003-r3/h80-s2-before-hydration-1280.png)・[768](evidence/epic-0003-r3/h80-s2-before-hydration-768.png)・[375](evidence/epic-0003-r3/h80-s2-before-hydration-375.png)、[後 1280](evidence/epic-0003-r3/h80-s2-after-hydration-1280.png)・[768](evidence/epic-0003-r3/h80-s2-after-hydration-768.png)・[375](evidence/epic-0003-r3/h80-s2-after-hydration-375.png)、[選び直し 1280](evidence/epic-0003-r3/h80-s2-repick-blue-1280.png)・[768](evidence/epic-0003-r3/h80-s2-repick-blue-768.png)・[375](evidence/epic-0003-r3/h80-s2-repick-blue-375.png)、[同じ画像 1280](evidence/epic-0003-r3/h80-s2-repick-same-1280.png)・[768](evidence/epic-0003-r3/h80-s2-repick-same-768.png)・[375](evidence/epic-0003-r3/h80-s2-repick-same-375.png)、[保存後 1280](evidence/epic-0003-r3/h80-s2-saved-1280.png)・[768](evidence/epic-0003-r3/h80-s2-saved-768.png)・[375](evidence/epic-0003-r3/h80-s2-saved-375.png) |
| #80 S3: 10MB 超（失敗の経路） | JS を止めて 11MB 超の JPEG を選び、放す。ハイドレーション後にもう一度 11MB 超を選ぶ。その後、正しい画像を選ぶ | PASS。ハイドレーション後に「ファイルが大きすぎます（1 枚 10MB まで）」の `alert` が出て、プレビューは 0 のまま（元のアイコンのまま）。ハイドレーション後に選んでも同じ理由が出る。続けて正しい画像を選ぶと `alert` は消えてプレビュー 1 つになる | [前 1280](evidence/epic-0003-r3/h80-s3-before-hydration-1280.png)・[768](evidence/epic-0003-r3/h80-s3-before-hydration-768.png)・[375](evidence/epic-0003-r3/h80-s3-before-hydration-375.png)、[後 1280](evidence/epic-0003-r3/h80-s3-after-hydration-1280.png)・[768](evidence/epic-0003-r3/h80-s3-after-hydration-768.png)・[375](evidence/epic-0003-r3/h80-s3-after-hydration-375.png)、[後で選ぶ 1280](evidence/epic-0003-r3/h80-s3-large-after-hydration-pick-1280.png)・[768](evidence/epic-0003-r3/h80-s3-large-after-hydration-pick-768.png)・[375](evidence/epic-0003-r3/h80-s3-large-after-hydration-pick-375.png) |

### AC-5 の Tab の順（[summary.json](evidence/epic-0003-r3/summary.json) の `keyboard`）

| 画面 | 1280px | 375px |
|---|---|---|
| 他人のプロフィール | 本文へ移動 → ホーム・検索・投稿・通知・プロフィール（左のナビ）→ フォローする → フォロワー → フォロー中 → 写真 3 → 2 → 1 | 本文へ移動 → フォローする → フォロワー → フォロー中 → 写真 3 → 2 → 1 → ホーム・検索・投稿・通知・プロフィール（下のナビ） |
| 編集 | 左のナビ → アイコンの選択 → 表示名 → 自己紹介 → 保存（Enter で保存） | 本文へ移動 → アイコンの選択 → 表示名 → 自己紹介 → 保存（Enter で保存） |

## ブラウザの状態

全ての画面と手順を通して、コンソールのエラー・警告・`pageerror`・失敗した要求・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0003-r3/summary.json) の `events`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求・状態 400 以上 |
|---|---|---|
| 他人のプロフィール、自分のプロフィール、別の context、未ログインの編集 → ログイン | 0 | 0 |
| 編集（空の表示名・入力後・保存・151 字・150 字・キーボード 375/1280） | 0 | 0 |
| #80 の S1・S2（Slow 3G）・S3（10MB 超）の全手順（JS を止めた間の保留を含む） | 0（警告 0） | 0 |
| 存在しない名前の 404 | 1（Chrome が 404 の応答に出す「Failed to load resource」。意図した結果） | 1（`/no_such_user_…` が 404。意図した結果） |

意図した 1 つの手順を除き、全て 0。

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（アプリのサーバーを止めて実行。typecheck・lint・format・docs・unit（445 件）・integration（226 件、4 件は skip）・build・e2e（150 件）・perf-budget（初回 JS 150920 / 170000 bytes）が全て OK。子 PBI の E2E `e2e/profile.spec.ts`・`e2e/profile-edit.spec.ts` を含む）。[verify.txt](evidence/epic-0003-r3/verify.txt) | 0 |

## 見つけた問題

なし
