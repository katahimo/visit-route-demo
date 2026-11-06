# AGENTS.md

このリポジトリで作業するAIコーディングエージェント向けのルール。
文書の索引は `docs/README.md`（読む前にここで該当ファイルを選ぶ）。要件の正は `docs/prd.md`（要件の表はテーマ別の `docs/prd/`）、設計の正は `docs/design.md`（画面の詳細は `docs/design/`）、境界の契約の正は `src/contracts/`（TypeScript の型と Worker のメッセージ）、判断の記録は `docs/adr/`。これらと矛盾する実装をしない。

このリポジトリは `katahimo-dev/visit-route-poc`（PoC本体）の**デモ版**。PoC本体の Firebase・Callable・`orgs/{orgId}` の規約は適用しない（ADR-0001）。

## 作業の原則
- 担当範囲（作業指示書に書かれたコンポーネント）以外のファイルを変更しない
- 契約（`src/contracts/`）にない入出力・エラー・既定値を勝手に足さない。必要なら作業を止めて質問する
- データ（`DemoData`）を書き換えるのは store だけ。画面は `update(fn)` を通す
- PRD §4・design.md §2 の「やらないこと」を実装しない（ログイン・サーバー保存・記録・勤怠・相性の学習など）
- 仕様が不明なときは推測で埋めず、`QUESTIONS:` として最後にまとめて報告する

## 設計・実装の原則（Clean / SOLID）
詳しくは `.claude/skills/solo-architecture-design/references/code-principles.md`。機械で見られる決まりは `code-rules.json` にあり、`npm run check:code` が検査する（PR の CI でも回す）。
- 依存は内側へだけ：`contracts` ← 計算の層（`domain`・`patterns`・`matching`・`solver`・`evaluate`・`reassign`・`vacancy`）← `lib`（画面のための純粋関数）← `store` ← `components` ← `pages`・`app`。計算の層と `lib` は React・store・DOM・画面を import しない（今ある例外は `code-rules.baseline.json` にあり、増やさない）。新しい React のフック（`use*`）は `components/` に置く
- 1ファイル 600 行・1関数（部品）150 行を超えない。巨大な部品に足すときは、足す分を先に分ける：計算は `lib/` の純粋関数（テスト付き）、状態と処理はカスタムフック、見た目は小さい部品
- データを作る・数える・判定する処理は画面に書かず、`lib/` か計算の層の純粋関数にしてテストを付ける
- 新しい関数・部品を作る前に、同じ働きのものを grep で探して使う（日付の書式・時刻の変換・件数の上限の判定・振り直しの手順など）。同じ名前で別の意味のものを作らない
- 種類（条件の型・繰り返し方・チップ）ごとの分岐は1か所に集め、switch は `const _: never = x` で網羅を型で確かめる
- 使われなくなった関数・部品・CSS・テストは同じ変更で消す
- `npm run check:code` で新しい違反を出さない。直して違反が減ったら `npm run check:code -- --update-baseline --sync-biome` で基準と `biome.json` を縮め、一緒にコミットする
- 層の決まりと関数の行数は `biome.json` にも同じものが入っている（層の違反は lint のエラー、150 行を超える関数は警告としてエディタに出る）。`biome.json` の `overrides` は `code-rules.json` から作る生成物なので手で直さない。決まりを変えるときは `code-rules.json` を直して `--sync-biome`

## ディレクトリ構成
```
src/
  contracts/   … 型と Worker メッセージ（境界の契約）
  store/       … localStorage・JSON入出力・版の確かめ（データの持ち主。古い版は移さず初期データで始める。ADR-0053）
  seed/        … デモの初期データ（PoC本体 scripts/seedDemo.ts から写す）・単発のデモ・空のデータ
  domain/      … PoC本体 packages/shared 等から写した純粋関数（先頭に写した元のコミットを書く）
  matching/    … 項目・条件 → Problem（可否・費用表）と理由
  solver/      … 焼きなまし（solve 純粋関数 ＋ worker.ts）
  evaluate/    … 採点・説明・差分
  excel/       … DemoData と Excel のブックの変換（ADR-0006。データは書き換えない）
  patterns/    … 繰り返しの回を見るときに計算する純粋関数（ADR-0012・ADR-0053）
  lib/         … 画面から使う純粋関数（React・store・画面の部品を import しない）
  components/  … 画面の部品と React のフック（use*）
  pages/       … 画面（components と lib を組み合わせる）
  app/         … 殻（App・ErrorBoundary・ルートと分けた画面 lazyPages）
.github/workflows/deploy.yml … test → build → Cloudflare Workers（wrangler。ADR-0071）
.github/workflows/e2e.yml … 速い検査（lint・型・check:code・check:prd・vitest）は PR の push ごと。e2e（4つに分けて並列）は PR に「e2e」のラベルを付けたとき・手動・週1回の夜間、perf は手動・夜間だけ（ADR-0029・ADR-0104）。Playwright の版を上げるときはイメージの版も上げる
e2e/ … @playwright/test の spec（scripts/e2e-*.cjs の段を test.step で回す。ADR-0041）
scripts/ … e2e のスクリプト（e2e-*.cjs）と共通の部品（lib/）
gas/ … メールの予約送信の Google Apps Script のひな型（Code.gs）と手順（README.md）。やりとりの正は src/contracts/mailSchedule.ts（ADR-0069）
code-rules.json・code-rules.baseline.json … コードの検査（npm run check:code）の決まりと、今ある違反の基準
docs/ … README.md（索引）/ prd.md・prd/（テーマ別の要件の表） / design.md / design/（画面の詳細）/ adr/
```

## コマンド
- インストール：`npm ci`。e2e のブラウザは `npx playwright install chromium`（`PLAYWRIGHT_BROWSERS_PATH` に版の合う Chromium があれば不要）
- 開発サーバー：`npm run dev`
- テスト：`npm test`（vitest）。重い計算（焼きなまし・Excel）の test は1つのファイルに溜めず、ファイルを分けて並列に回す（ファイルは worker 1つで直列）。分けたファイルで使い回す部品は `*.testkit.ts`（check:code の対象外。例 `src/evaluate/naiveSeed.testkit.ts`・`src/excel/excel.testkit.ts`）
- フォーマット・リント：`npm run lint`（biome と、競合の印 `<<<<<<<`・`>>>>>>>` の検査 `scripts/check-conflict-markers.cjs`）
- 型チェック：`npm run typecheck`
- コードの検査：`npm run check:code`（層の依存・循環 import・長いファイルと関数・使われない export。`code-rules.baseline.json` の基準より増えたら失敗。`-- --all` で基準にあるものも表示。`biome.json` が `code-rules.json` とずれていても失敗。Python 3 が要る）
- PRD の検査：`npm run check:prd`（索引とテーマ別ファイルの一致・D番号の重複と使い回し・廃止の行・表の並び・大きさ。`-- --fix` で索引と並びを作り直す）
- ビルド：`npm run build`（`dist/`、`base: './'`）
- e2e（本物のブラウザ。ADR-0029）：`npm run e2e`（速さを見る5本を除く残りを4本ずつ並列）・`npm run e2e:perf`（速さを見る5本を1本ずつ）・`npm run e2e:all`（e2e のあとに e2e:perf）。1本だけは `npx playwright test --grep "e2e-details\.cjs"`。走らせ方の注意・書き方（段・待ち方）・環境変数・各スクリプトで確かめることは [docs/e2e.md](docs/e2e.md)。e2e を足す・直すときは先に読む

## 規約
- 言語：TypeScript（strict）、React 19、Vite。コメント・ドキュメント・コミットメッセージは日本語
- ルーティングは HashRouter（Pages のサブパスで再読込しても 404 にしない）
- 再現性：solver・matching・evaluate・seed に `Math.random`・`Date.now` を入れない。乱数は seed 付き、止めるのは反復回数
- 費用は「分」に換算する（design.md §5 の表）。solver と evaluate は同じ `Problem` を使い、合計点を一致させる
- 外部送信は地図タイルの取得と、利用者がボタンを押したときの郵便番号・住所の検索（`src/lib/geocode.ts` の1か所。ADR-0016）と、日の予定のメールの予約送信（押したときに事業所自身の Google Apps Script へ。`src/lib/mailSchedule.ts` の1か所。ADR-0069）と、押したときの道路の所要の取得（地点の緯度・経度だけを OSRM の公開サーバーへ。`src/lib/roadTable.ts` の1か所。ADR-0101）だけ。解析・ログ送信を入れない
- リンク（Google マップの Maps URLs）・mailto は、押すのが人でアプリは送らないので外部送信に当たらない（ADR-0017・0018）
- 同梱するデータは架空のものだけ。公開リポジトリに実在の人・住所・パスワード・キーを置かない
- 要件（PRD）：要件の表は `docs/prd/<テーマ>.md` に置き、`docs/prd.md` には置かない。足すときは該当テーマの表に `npm run check:prd` が示す次の D番号で行を足す（ADR 単位・追加順の節は作らない）。置き換えた要件は表から消し、`docs/prd.md` の「廃止した D番号」に置き換え先を足す。D番号は振り直さない・使い回さない。索引は手で直さず `npm run check:prd -- --fix` で作る（手順は `.claude/skills/solo-architecture-design/SKILL.md`「設計書を育てる」）
- 画面：主ボタン（濃い朱）は画面に1つ（多くて2つ）。呼び方は `org.terms` から引き、「お客様」「シッター」を直書きしない。表記は常用漢字
- 更新の知らせ：利用者の目に見える変更を出すときは `src/lib/releaseNotes.ts` の `RELEASE_NOTES` の先頭に1件足す（id は出す日。PRD D437。ADR-0102）
- 文言：事実を短く。AI っぽい言い回し（「〜だけ教えてください」「かんたん」「すぐに」「〜しましょう」）や大げさな形容を使わない

## 完了の定義
- [ ] テスト・リント・型チェック・ビルド・コードの検査・PRD の検査がすべて通る
- [ ] 画面・計算・e2e に関わる PR は、マージの前に「e2e」のラベルを付けて CI の e2e を通す（push ごとには走らない。ADR-0104）
- [ ] 足した計算（純粋関数）にテストがある。使われなくなったコードを消した
- [ ] 契約（`src/contracts/`）どおりの入出力・エラーになっている
- [ ] 変更点と、推測した箇所（あれば）を報告した
