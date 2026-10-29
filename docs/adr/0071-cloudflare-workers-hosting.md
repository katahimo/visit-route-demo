# ADR-0071：公開先を GitHub Pages から Cloudflare Workers（静的アセット）に移し、リポジトリを非公開にできるようにする

- 日付：2026-10-29
- 状態：採用（ADR-0001 の公開先・公開リポジトリの前提を置き換える）

## 背景
ADR-0001 は GitHub Free の Pages に公開リポジトリが要るため、公開先を GitHub Pages にした。
リポジトリを非公開にしたい。Cloudflare は GitHub Actions からビルド済みの `dist/` を直接アップロードして公開でき、非公開リポジトリでも使える。Cloudflare Pages は Workers に統合されつつあり、`wrangler pages` も新規には Workers へ公開する動きになった。

## 選択肢
1. 案A：GitHub Pages のまま（公開リポジトリ）
2. 案B：GitHub Actions でテスト→ビルド→`wrangler deploy` で Cloudflare Workers（静的アセット）へ公開
3. 案C：Cloudflare Pages（`wrangler pages deploy`・`--force`）
4. 案D：Cloudflare の Git 連携（Cloudflare 側でビルド）

## 決定
案B。

## 理由とトレードオフ
- 得るもの：リポジトリを非公開にできる。lint・test を通ったものだけ公開する今のゲートを保てる。無料枠で0円（静的アセットの配信は無制限）。Cloudflare が今後の主流とする方式
- 失うもの：GitHub の Secrets（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`）が要る。トークンに Workers Scripts の編集権限が要る。公開 URL（`*.workers.dev`）は非公開リポジトリでも誰でも開ける（必要なら Cloudflare Access で絞る）

## 影響
- `wrangler.jsonc`（名前 `visit-route-demo`・`assets.directory: ./dist`）と `deploy.yml`（`cloudflare/wrangler-action@v3` の `deploy`）
- 画面は HashRouter・`base: './'` のままで、Workers の静的アセットでも再読込・チャンクの読み込みは動く
- 同梱データは引き続き架空のものだけ（公開 URL は誰でも開ける）
