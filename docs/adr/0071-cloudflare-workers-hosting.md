# ADR-0071：公開先を GitHub Pages から Cloudflare Workers（静的アセット）に移し、リポジトリを非公開にできるようにする

- 日付：2026-10-29
- 状態：採用（ADR-0001 の公開先を置き換え）

## 背景
GitHub Free の Pages では公開リポジトリが要る。リポジトリを非公開にしたい。

## 決定
GitHub Actions でテスト → ビルド → `wrangler deploy` で Cloudflare Workers（静的アセット）へ公開する。
- `wrangler.jsonc`（名前 `visit-route-demo`・`assets.directory: ./dist`・`routes`）と `deploy.yml`（`cloudflare/wrangler-action@v3`）
- 画面は HashRouter・`base: './'` のまま
- 公開名は `staff-assign-demo.katahimo.com`（各デモは `<名前>-demo.katahimo.com`。`katahimo.com` の1段下）
- 同梱データは架空だけ（公開 URL は誰でも開ける）

## 捨てた案
GitHub Pages のまま（公開リポジトリが要る）・Cloudflare Pages（Workers に統合されつつある）・Cloudflare の Git 連携（lint・test のゲートを保てない）。

## トレードオフ
- 失うもの：Secrets（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`）が要る。公開 URL は誰でも開ける（必要なら Cloudflare Access で絞る）
