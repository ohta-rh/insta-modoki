---
type: TestReport
title: EPIC #3 プロフィールの総合試験（2 回目、PASS）
description: ADR-0048 によるやり直し。リファクタ 52a1ddb..836c2e6 の後の b74f364 で、EPIC #3 の 5 つの受け入れ条件と、グリッドの無限スクロール・アイコン・編集の失敗・モーダルのフォーカスを実ブラウザ（Google Chrome 157）で確かめた。全て PASS。
tags: [epic-test]
---

# EPIC #3 プロフィールの総合試験（2 回目）

## 対象

- EPIC: [#3](https://github.com/ohta-rh/insta-modoki/issues/3)。1 回目は [epic-0003-profile.md](epic-0003-profile.md)（PASS）。
- やり直しの理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。リファクタ `52a1ddb..836c2e6` が、プロフィールの Server Action の失敗の扱い（`src/shared/action.ts`）、グリッドのページ送り（`src/shared/db/cursor.ts`、`list-profile-posts.ts`）、アイコンの URL（`avatarUrl`）、プロフィール取得、セッション確認、モーダルのフォーカスの閉じ込め（`focus-trap.ts`）に触れた。
- 試験した commit: `b74f364`（ブランチ `epic-test/3`、`main` から切ったもの）
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（別のセッションがプロファイルを握っている）。[ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。
- データ: 空のスロットに、`pnpm seed:demo`（アプリ自身の seed。この試験では使っていない）を流した後、利用者 A（投稿 3 件）・P（投稿 28 件、ページ送りの確認用。1 ページ 12 件）・B のサインアップと全ての投稿・プロフィールの保存を UI から行った。パスワードは実行時に生成し、どこにも書いていない。
- 項目ごとのデータ: [summary.json](evidence/epic-0003-r2/summary.json)

## 結果

PASS。AC-1〜5 は実ブラウザで満たした。やり直しで特に見た 4 点（無限スクロールの重複・抜け、アイコン、編集の失敗、モーダルのフォーカス）も問題なし。見つけた問題は無い。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | B で、UI から作った A（投稿 3 件、自己紹介あり）の `/<username>` を開く。次に存在しない名前を開く | PASS。ヘッダーに「撮影者 A」・`@ユーザー名`・自己紹介（改行を保つ）・「3 投稿」「0 フォロワー」「0 フォロー中」。グリッドは 3 列で、タイルは正方形（1280px で 208.7×208.7、768px で 173.3×173.3、375px で 123.7×123.7）、間隔は 3 幅とも 2px。並びは新しい順（投稿の作成順の逆）。編集のリンクは無い。存在しない名前は状態 404 で「ページが見つかりません」（失敗の経路） | [他人 1280](evidence/epic-0003-r2/ac1-other-profile-1280.png)・[768](evidence/epic-0003-r2/ac1-other-profile-768.png)・[375](evidence/epic-0003-r2/ac1-other-profile-375.png)、[404 1280](evidence/epic-0003-r2/ac1-404-1280.png)・[768](evidence/epic-0003-r2/ac1-404-768.png)・[375](evidence/epic-0003-r2/ac1-404-375.png) |
| AC-1（やり直しの重点: ページ送り） | B で 28 件の投稿がある P のプロフィールを開き、末尾までスクロールを繰り返す（1280 と 375 の両方） | PASS。タイルは 12 → 28 件（375px では 12 → 24 → 28）。28 件全て href が異なり（重複 0）、並びは投稿の新しい順と完全に一致（抜け 0、順序の乱れ 0）。ヘッダーは「28 投稿」。全タイルに空でない `alt` | [最初の 12 件 1280](evidence/epic-0003-r2/grid-page1-1280.png)・[768](evidence/epic-0003-r2/grid-page1-768.png)・[375](evidence/epic-0003-r2/grid-page1-375.png)、[全部読み込み後 1280](evidence/epic-0003-r2/grid-all-loaded-1280.png)・[768](evidence/epic-0003-r2/grid-all-loaded-768.png)・[375](evidence/epic-0003-r2/grid-all-loaded-375.png)、[末尾 1280](evidence/epic-0003-r2/grid-bottom-1280.png)・[768](evidence/epic-0003-r2/grid-bottom-768.png)・[375](evidence/epic-0003-r2/grid-bottom-375.png)、[スマホ幅で読み込んだ末尾](evidence/epic-0003-r2/grid-bottom-375-mobile.png) |
| AC-2 | B で `/accounts/edit` を開き、表示名を空にして（失敗の経路）、次に表示名「新しい名前 B 😀」・自己紹介 2 行・アイコン（800×600 の JPEG）を入れる。アイコンの送信をネットワーク遮断で失敗させ（失敗の経路）、遮断を外して保存。別のブラウザ（A の Cookie）で `/<B>` を開き、再読み込みだけ行う | PASS。表示名が空だと「表示名は 1〜30 字で入力してください」が出て保存ボタンが無効。送信の失敗は「アップロードに失敗しました。もう一度お試しください」が出て、入力（表示名・自己紹介・プレビュー）が残る。遮断を外して保存すると B の `/<username>` へ移り、新しい表示名・自己紹介（2 行）・アイコン（Garage の画像、`naturalWidth` 320）が出る。別の context でも同じ値とアイコン（読み込めた）が出て、編集のリンクは無い（自分にはある） | [空の表示名 1280](evidence/epic-0003-r2/ac2-fail-empty-name-1280.png)・[768](evidence/epic-0003-r2/ac2-fail-empty-name-768.png)・[375](evidence/epic-0003-r2/ac2-fail-empty-name-375.png)、[入力後 1280](evidence/epic-0003-r2/ac2-edit-filled-1280.png)・[768](evidence/epic-0003-r2/ac2-edit-filled-768.png)・[375](evidence/epic-0003-r2/ac2-edit-filled-375.png)、[送信の失敗 1280](evidence/epic-0003-r2/ac2-save-failed-1280.png)・[768](evidence/epic-0003-r2/ac2-save-failed-768.png)・[375](evidence/epic-0003-r2/ac2-save-failed-375.png)、[保存後の自分 1280](evidence/epic-0003-r2/ac2-own-after-1280.png)・[768](evidence/epic-0003-r2/ac2-own-after-768.png)・[375](evidence/epic-0003-r2/ac2-own-after-375.png)、[別の context 1280](evidence/epic-0003-r2/ac2-other-view-1280.png)・[768](evidence/epic-0003-r2/ac2-other-view-768.png)・[375](evidence/epic-0003-r2/ac2-other-view-375.png) |
| AC-3 | 自己紹介に 151 字を入れる。開き直す。次に 150 字を入れて保存 | PASS。151 字は「自己紹介は 150 字までです」と「151 / 150」が出て保存ボタンが無効。プロフィールを開き直しても保存されていない。150 字は警告が出ず保存でき、プロフィールに 150 字が出る | [151 字 1280](evidence/epic-0003-r2/ac3-151-refused-1280.png)・[768](evidence/epic-0003-r2/ac3-151-refused-768.png)・[375](evidence/epic-0003-r2/ac3-151-refused-375.png)、[150 字 1280](evidence/epic-0003-r2/ac3-150-saved-1280.png)・[768](evidence/epic-0003-r2/ac3-150-saved-768.png)・[375](evidence/epic-0003-r2/ac3-150-saved-375.png) |
| AC-4 | B で A のプロフィールを開く。未ログインの context でも開く。未ログインで `/accounts/edit` を開く。B 自身のプロフィールを開く | PASS。A のプロフィールに「プロフィールを編集」は無い（B からも未ログインからも 0 件）。未ログインの `/accounts/edit` は `/accounts/login` に移る。B 自身にはある | [他人 1280](evidence/epic-0003-r2/ac4-others-profile-1280.png)・[768](evidence/epic-0003-r2/ac4-others-profile-768.png)・[375](evidence/epic-0003-r2/ac4-others-profile-375.png)、[未ログインの編集 1280](evidence/epic-0003-r2/ac4-anon-edit-to-login-1280.png)・[768](evidence/epic-0003-r2/ac4-anon-edit-to-login-768.png)・[375](evidence/epic-0003-r2/ac4-anon-edit-to-login-375.png) |
| AC-5 | 375px と 1280px で、プロフィールと編集の画面を Tab・文字入力・Enter だけで操作。画像の `alt`、コンソール、通信を調べる | PASS。プロフィールは両幅とも全てのリンク・ボタンに Tab が届く（下の表）。編集は表示名 → 自己紹介 → 保存（Enter）で保存して B のプロフィールへ戻れた。横のスクロールは無い。グリッドの写真は全て空でない `alt`（「撮影者 A の写真 N」）。ヘッダーのアイコンは `alt=""`（飾り。[1 回目の Director の判定](epic-0003-profile.md)と同じ）。コンソールと通信は、意図した 404 と意図した通信遮断を除き 0 | [プロフィール 1280](evidence/epic-0003-r2/ac5-profile-keyboard-1280.png)・[375](evidence/epic-0003-r2/ac5-profile-keyboard-375.png)、[編集 1280](evidence/epic-0003-r2/ac5-edit-keyboard-1280.png)・[375](evidence/epic-0003-r2/ac5-edit-keyboard-375.png) |
| 追加（モーダルのフォーカス） | P のグリッドを 2 ページ目まで読み込み、20 番目のタイル（1 ページ目の外）をクリック。Tab・Shift+Tab を 25 回ずつ。Esc | PASS。URL が `/p/<id>` になりモーダルが開き、フォーカスは「閉じる」に移る。Tab 25 回・Shift+Tab 25 回の全てでフォーカスはモーダルの中（外へ出た回数 0）。Esc で閉じ、URL は `/<P のユーザー名>` に戻り、押したタイルにフォーカスが戻り、グリッドは 28 件のまま | [開いた 1280](evidence/epic-0003-r2/modal-open-1280.png)・[768](evidence/epic-0003-r2/modal-open-768.png)・[375](evidence/epic-0003-r2/modal-open-375.png)、[閉じた 1280](evidence/epic-0003-r2/modal-closed-1280.png)・[768](evidence/epic-0003-r2/modal-closed-768.png)・[375](evidence/epic-0003-r2/modal-closed-375.png) |

### AC-5 の Tab の順（[summary.json](evidence/epic-0003-r2/summary.json) の `keyboard`）

| 画面 | 1280px | 375px |
|---|---|---|
| 他人のプロフィール | 本文へ移動 → ホーム・検索・投稿・通知・プロフィール（左のナビ）→ フォローする → フォロワー → フォロー中 → 写真 3 → 2 → 1 | 本文へ移動 → フォローする → フォロワー → フォロー中 → 写真 3 → 2 → 1 → ホーム・検索・投稿（下のナビ）… |
| 編集 | 左のナビ → 表示名 → 自己紹介 → 保存（Enter で保存） | アイコンの選択 → 表示名 → 自己紹介 → 保存（Enter で保存） |

## ブラウザの状態

全ての画面と手順を通して、コンソールのエラー・警告・`pageerror`・失敗した要求・状態 400 以上の応答を数えた（[summary.json](evidence/epic-0003-r2/summary.json) の `events`）。

| 画面 | コンソールのエラー・警告 | 失敗した要求・状態 400 以上 |
|---|---|---|
| 他人のプロフィール、P のグリッド（1 ページ目・無限スクロール・375px）、モーダルの開閉、自分のプロフィール、別の context、未ログインの編集 → ログイン | 0 | 0 |
| 編集（空の表示名・入力後・保存の成功・151 字・150 字・キーボード 375/1280） | 0 | 0 |
| 存在しない名前の 404 | 1（Chrome が 404 の応答に出す「Failed to load resource」。意図した結果） | 1（`/no_such_user_zz9` が 404。意図した結果） |
| 編集の「送信の失敗」の手順（アイコンの送信を `route.abort()` で遮断。失敗の経路の再現） | 4（遮断した PUT の `net::ERR_FAILED`） | 4（遮断した署名付き PUT。意図した結果） |

意図した 2 つの手順を除き、全て 0。

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（アプリのサーバーを止めて実行。typecheck・lint・format・docs・unit（443 件）・integration（226 件、4 件は skip）・build・e2e（139 件）・perf-budget が全て OK。子 PBI の E2E `e2e/profile.spec.ts`・`e2e/profile-edit.spec.ts`、#41 の `e2e/post-modal.spec.ts`、#42 の `e2e/follow.spec.ts` を含む）。[verify.txt](evidence/epic-0003-r2/verify.txt)。なお最初の実行は、試験の足場の script を worktree に置いたため lint で失敗した。script を worktree の外へ移して流し直した | 0 |

## 見つけた問題

なし
