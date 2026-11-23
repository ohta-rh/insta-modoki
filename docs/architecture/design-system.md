---
type: Architecture
title: デザインシステム（トークン・ロゴ・アイコン・ナビ）
description: 色・余白・文字の大きさのトークン、自作のロゴとアイコン、使わない他社の資産と禁止語、色の使い方の決まり、画面の骨格（AppShell とナビの切り替え）。画面の PBI はこれを前提に作る。
tags: [architecture, design, accessibility]
status: stable
---

# デザインシステム

すべての画面が同じ色・余白・ナビを使うための決まり。値の持ち主は `src/shared/ui/tokens.css`（Tailwind の `@theme`）で、`tokens.ts` が同じ値を TypeScript に持つ。両者は `tokens.test.ts` が突き合わせる。他社のブランドは使わない（[ADR-0003](../adr/0003-reproduce-ux-under-own-brand.md)）。

## トークン

| 名前 | 値 | 使い方 |
|---|---|---|
| `--color-bg` / `--color-wash` | `#ffffff` / `#fafafa` | 背景 / 薄い背景（補助の文字を置ける） |
| `--color-surface` / `--color-highlight` | `#f3f5f7` / `#efefef` | 面（カード・ホバー・頭文字の丸） / 押した・選んだ面。文字は `text` |
| `--color-text` | `#000000` | 本文 |
| `--color-text-secondary` | `#737373` | 補助の文字（`bg` と `wash` の上だけ） |
| `--color-icon` / `--color-icon-secondary` | `#262626` / `#737373` | アイコン |
| `--color-border` / `--color-input-border` | `#dbdbdb` / `#8e8e8e` | 罫線 / 入力の枠（3:1 以上） |
| `--color-link` / `--color-indigo` | `#4f46c8` | リンク・主のボタン・文字のボタン・フォーカスの輪郭 |
| `--color-danger` | `#d62d3c` | エラー・削除の文字と枠 |
| `--color-like` | `#f2545b` | 塗ったハート |
| `--color-teal` / `--color-coral` | `#0bb8a9` / `#ff6b5e` | 図形・塗り（文字には使わない） |
| `--gradient-window` | `linear-gradient(120deg, #0bb8a9, #2b6cf6 62%, #4f46c8)` | ロゴの窓・ストーリーの輪 |
| `--space-1`〜`--space-8` | 4・8・12・16・24・32・48・64px | 余白 |
| `--feed-item-gap` | 20px | フィードの投稿の間 |
| `--font-size-xs`〜`--font-size-xl` | 12・14・16・20・24px | 文字の大きさ（`html` は 16px、`body` は 14px / 行の高さ 18px） |
| `--leading-xs`〜`--leading-xl` | 16・18・24・25・30px | 行の高さ（`leading-*`） |
| `--font-family` | `-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Sans JP', sans-serif` | ウェブフォントは読み込まない |
| `--radius-pill` | 22px | `rounded-pill`（他の角丸は Tailwind の既定） |
| `--shadow-panel` | `0 4px 32px 0 rgba(11, 16, 20, 0.16)` | 重ねるパネルの影 |
| `--breakpoint-nav` / `--breakpoint-aside` / `--breakpoint-nav-wide` | 768 / 1160 / 1264px | 下部ナビとサイドナビの切り替え（`nav:`） / 右の列が出る幅（`aside:`） / ナビが広くなる幅（`nav-wide:`） |
| `--tap-min` | 44px | タップ領域の最小（参照の 40px より大きい。#46 の検査を優先する） |
| `--nav-wide-width` / `--nav-narrow-width` | 244px / 72px | 左のナビの幅 |
| `--bottom-nav-height` / `--mobile-top-bar-height` / `--public-top-bar-height` | 50 / 45 / 60px | 下部ナビ / モバイルの上部バー / 公開ページの上部バー |
| `--feed-width` / `--content-max` | 470px / 630px | フィードの列 / ストーリーの列と本文の最大幅 |
| `--aside-width` / `--aside-gap` / `--site-width-wide` | 319 / 64 / 935px | 右の列・その間隔・広い画面の全体の幅 |
| `--post-aside-width` / `--side-panel-width` | 335 / 397px | 投稿詳細の右の列 / 横から出るパネル |
| `--motion-fast` / `--motion-panel` | 150ms / 200ms（視差効果を減らす設定で 0ms） | トランジション・パネルの長さ |
| `--ease-move-in` | `cubic-bezier(0.17, 0.17, 0, 1)` | パネルの動き |

値の根拠は [ADR-0056](../adr/0056-ui-follows-measured-web-reference-under-own-brand.md) と `docs/research/web-ui-reference.md` §3。

## 色の使い方の決まり

- 本文の組は 4.5:1 以上。`contrast.ts` の `BODY_PAIRS`（`text`/`bg`・`text`/`surface`・`text`/`highlight`・`text-secondary`/`bg`・`text-secondary`/`wash`・`link`/`bg`・`danger`/`bg`・`bg`/`indigo`）を `contrast.test.ts` が確かめる。
- 補助の文字（`text-text-secondary`）は `bg` と `wash` の上だけ。`surface`（4.34:1）と `highlight`（4.12:1）の上では `text-text` にする。ホバーで面になる要素は `hover:text-text` を足す。`token-usage.test.ts` が全ての `.tsx` を走査して確かめる。
- 図形（いいねの赤・補助のアイコン・入力の枠）は `bg` の上で 3:1 以上（`NON_TEXT_PAIRS`）。
- エラー・削除の赤は `text-danger` / `border-danger`、塗ったハートは `text-like`。Tailwind の `red-*` は直書きしない。
- 行の高さ: `body` は絶対値 18px（`--leading-sm`）。`globals.css` の 5 つの規則 `[class~='text-[length:var(--font-size-X)]']`（X は xs〜xl）が、文字の大きさを自分で決める部品に対の `--leading-*` を付ける。`md:text-[length:…]` のように前置きの付いた大きさのクラスには付かないので、その部品は `leading-*` を自分で足す。
- `text-danger` は `surface`（4.47:1）・`highlight` の上に置かない。ホバーで面にするなら `hover:bg-wash`。`token-usage.test.ts` が確かめる。
- ティール・コーラル・インディゴは文字色に使わない。コーラル（2.79:1）とティール（2.49:1）は白の上で 3:1 に届かないので、状態を伝える図形はインディゴか文字色と形（塗りつぶし）で示す。
- フォーカスの輪郭は 2px のインディゴ（白の上で 6.9:1）、オフセット 2px（`globals.css`）。
- 色だけで状態を伝えない（現在のナビは太字と線でも示す）。

## ロゴ

アーチ窓と陽の光。自作。`public/brand/logo.svg`（印とワードマーク）・`logo-mark.svg`・`favicon.svg`、React では `Logo`。名前 Mado は仮称（M2 で確定）で、`aria-label` は「Mado（仮称）」。

## アイコン

`src/shared/ui/icons/` の SVG の部品。全て自作で、24px の格子・線の太さ 2（[ADR-0056](../adr/0056-ui-follows-measured-web-reference-under-own-brand.md)）・`aria-hidden="true"`（名前は使うボタンやリンクが持つ）。`HomeIcon` `SearchIcon` `CompassIcon` `PlusSquareIcon` `BellIcon` `UserIcon` `HeartIcon` `HeartFilledIcon` `CommentIcon` `SendIcon` `BookmarkIcon` `BookmarkFilledIcon` `CloseIcon` `ChevronLeftIcon` `ChevronRightIcon` `MoreIcon` `MenuIcon`（3 本線）。`GridIcon`（3×3 の格子）と `CarouselIcon`（重なった 2 枚）は #93 が足す。

ナビの 6 つ（ホーム・検索・発見・投稿・通知・プロフィール）には塗りつぶしの版（`HomeFilledIcon` `SearchFilledIcon` `CompassFilledIcon` `PlusSquareFilledIcon` `BellFilledIcon` `UserFilledIcon`）があり、`svg[data-filled="true"]` が付く。今の項目はこちらで描く（`SearchFilledIcon` は svg の線は 2 のまま、レンズと柄だけ 3 で太く描く）。くり抜き（プラス・針）は背景色（`stroke-bg`）の線で描く。他社のアイコンの形を写さない。

## 使わない他社の資産と禁止語

他社の名前・ロゴ・アイコン・フォント・画像・スクリプトを使わない。`public/brand/` と `src/shared/ui/` に、他社のサービス名とその略称、運営会社名（フッターの「Meta 社とは関係ありません」を除く）、外部の URL（SVG の名前空間を除く）を書かない。`brand.test.ts` が確かめる。

## 画面の骨格

`AppShell`（`currentPath`・`viewer`・`badges?`・`linkAs?`・`hideNav?`・`children`）が、スキップリンク（「本文へ移動」、`#main`）→ 上部バー（モバイルのみ）→ サイドナビ → `<main id="main">`（最大幅 630px、中央）→ フッター（`data-shell-footer`）→ 下部タブの順に描く。

- 3 段（CSS だけ。`nav:` = 768px、`nav-wide:` = 1264px）: 768px 未満は下部タブ（高さ 50px と下の安全領域、アイコンだけ）と上部バー（高さ 45px・下線 1px、左にロゴ（印と名前）、右に「その他」）。768〜1263px は幅 72px のサイドナビ（アイコンだけ、名前は `sr-only`、ロゴは印だけ）。1264px 以上は幅 244px（アイコンと名前、ロゴは印と名前）。上部バーとサイドナビの「その他」は `viewer` がいて `hideNav` でないときだけ。
- 項目の並びは `src/shared/ui/nav-items.ts`: ホーム・検索（`/explore/search`、`placement: 'side'`）・発見（`/explore`）・投稿・通知・プロフィール。下部タブは `placement: 'all'` の 5 項目。ログインしていない（`viewer` が `null`）と、投稿・通知・プロフィールは `/accounts/login` へ向かう。
- サイドナビの項目は高さ 48px 以上・角丸 8px・文字 16px の黒。現在の項目は塗りつぶしのアイコンと太字（`aria-current="page"`）で示し、線は引かない。判定（`isCurrent`）は、`/` はちょうど `/` のとき、他は先頭が一致するとき。ただしより長い `href` の別の項目も一致するときは偽（`/explore/search` で発見は現在にならない）。
- 「その他」（`MoreMenu`）は `popover="auto"` の部品で、`popovertarget` を持つボタン（サイドナビの一番下、モバイルは上部バーの右）が開く。JavaScript 無しで開き、Esc と外を押すと閉じる。中身は `MORE_LINKS`（プロフィールを編集 `/accounts/edit`、ログアウト `/accounts/logout`）。`aria-expanded` は `toggle` イベントで押し手へ写し、閉じたらフォーカスを押し手へ戻す。
- `AppShell` と `MoreMenu` の長いクラスの並びは `src/shared/ui/shell.css` の `shell-*` クラス（`@layer components`）に置く。クラスの文字列は JavaScript として配られ、ADR-0046 の初回 JS の予算に数えられるため。上書きはユーティリティクラスで行う。
- 未読のバッジは通知のリンクの囲みの中に置く（244px は行の右端、72px とモバイルはアイコンの右上）。
- `<main>` は既定で最大 630px。中に `data-page-width="wide"` の要素がある画面は、利用できる幅いっぱいになる（`has-[[data-page-width=wide]]:max-w-none`）。
- ルートのレイアウトは `AppShellClient`（`usePathname()` で現在のパスを取る）で包む。登録・ログインの画面は `hideNav` を使う。
- 項目は `next/link` ではなく通常の `<a>`。まだ無い画面を先読みして 404 を出さないため。画面が揃ったら、先読みの要否を #46 の検査と合わせて見直せる。

## アクセシビリティ

主要 8 画面と 2 つの重ねた画面（投稿のモーダル・いいねした人の一覧）を、375px で `e2e/a11y.spec.ts`（axe: `wcag2a`・`wcag2aa`・`wcag21a`・`wcag21aa`・`wcag22aa` の `critical`・`serious`、タップ領域 44×44px、alt、いいねの状態、`h1`、`lang`）、`e2e/keyboard.spec.ts`（キーボードだけの通し・輪郭 2px 以上・モーダルの閉じ込め）、`e2e/reduced-motion.spec.ts`（視差効果を減らす設定）が検査する（#46）。

- 写真の代わりの文は `photoAlt`（`src/features/post/model/alt-text.ts`）が 1 か所で作る。投稿者の文が無いときは `<username> が投稿した写真（<位置> / <枚数>）`。投稿詳細・カルーセル・フィード・プロフィールのグリッド・モーダルが使う。ヘッダーのアイコンの `alt=""` は、隣に名前がある飾りなので正しい。
- 動き（実際に動くもの）: カルーセルの `scroll-behavior`（設定が無いと `smooth`、視差効果を減らす設定で `auto`）と、モーダルの `post-modal-in`（`animation-duration` が設定の無いとき 0 より大きく、減らす設定で 0s）。`transition-duration` は減らす設定で 0s。
- axe は途中の透明度の色で対比を測るので、モーダルの検査は出現の動き（`document.getAnimations()`）が終わるのを待つ。

見つかった違反と直した所:

| 規則 | 画面 | 直した所 |
|---|---|---|
| 操作できる要素が 44×44px 以上（AC-7） | 投稿の作成 | 比率のラジオ 2 つ（13×13px）を `CreatePostForm.tsx` で `--tap-min` の大きさにした |
| 視差効果を減らさないときの動き（AC-6） | 投稿詳細（カルーセル） | 帯の `scroll-behavior` が `auto` のままだったので、`Carousel.tsx` に `motion-safe:scroll-smooth` を足した（モーダルの `post-modal-in` は元から正しく、直していない） |
| 写真の代わりの文の形（AC-8） | 投稿詳細・フィード・プロフィールのグリッド・モーダル | `@<username> の写真 <n>` を `photoAlt` の `<username> が投稿した写真（<位置> / <枚数>）` に統一した |

上の他に、axe の重大・深刻な違反、`h1` の数、`lang`、輪郭の太さ、モーダルの閉じ込め、いいねの `aria-pressed` と形は、最初の検査で違反が無かった。
