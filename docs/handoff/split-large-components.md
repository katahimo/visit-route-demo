# 作業指示書：巨大な部品・関数を分ける（Clean / SOLID の (3)）

全部の分割が終わったらこのファイルを消す（git に残る）。

## 1. 目的と範囲
- `npm run check:code -- --all` の `[func-lines]`（150 行を超える関数・部品）と `[file-lines]`（600 行を超えるファイル）を減らす
- **挙動（表示・文言・data-testid・データ・計算結果）は変えない。** e2e（scripts/e2e-*.cjs）は直さずに通ること（data-testid・文言を変えない）
- 1つの担当（下の表の1行）を1つのセッションで受け持ち、PR を作って CI が緑になったら main にマージするところまで行う。大きい担当（PlanPage など）は PR を2〜3本に分けてよい

## 2. 担当と順番

同じ波の担当は、触るファイルが重ならないので同時に進めてよい。次の波は前の波がすべてマージされてから始める（共通の関数を前の波で作るため）。

| 波 | 担当 | 対象（`[func-lines]` の主なもの） | 先に作る共通の関数（作ったら後の波が使う） |
|---|---|---|---|
| 1 | A1 訪問の欄と部品 | components/VisitPanel（766 行）・PersonCalendar（592）・choiceBand（358）・dayList | `lib` に `prevStopOf(data, visitId)`（道順の起点。VisitPanel・PlanPage・StaffViewPage で同じ計算）。空き枠に入れる知らせ `useInsertNotice`（PersonCalendar と WeekPage） |
| 1 | A2 中核 | excel/importBook（`importWorkbook` 849 行）・exportBook・importRoster、solver/anneal（`createSolver`）、matching/compile、store/repair・react、lib/monthBatch（`createMonthBatch`） | excel の読み込みの部品を `excel/reader.ts` へ。シートごとに `readXxx(ctx)` |
| 1 | A3 日の予定 | pages/PlanPage（`PlanPage` 2,790 行・`VisitList`）・absenceParts・SuddenPanel・reassignParts・mailPanels | `planReassign(data, date, absence)`（振り直しの手順。PlanPage と absenceParts）、`reasonOfRoutes(...)`（点数の理由。PlanPage と ComparePage）、`useReassignFlow` |
| 2 | B1 月・週 | pages/MonthPage（1,416）・WeekPage（1,253） | `confirmReady(targets, problemOf)`（まとめて確定）、`rangeProgress(dates, …)`（月の monthProgress を範囲で） |
| 2 | B2 空き状況 | pages/VacancyPage（1,083）・AvailabilityPage | `lib/hold.ts` の `holdData`（仮押さえで DemoData を作る）、`newClient(overrides)`（ClientPage と共用） |
| 2 | B3 AI で組む | pages/ComparePage（930）・ArrangePage・StandardPage | `lib/compareChoices.ts`（比べる案の一覧） |
| 3 | C1 人の画面 | pages/ClientPage・StaffPersonPage・PatternsSection・ClientLeavesSection・ClientsPage・StaffPage・StaffViewPage・CompatPage・OffboardPanel・PlaceAllPanel・WorkloadPage | — |
| 3 | C2 設定・データ | pages/DataPage・RulesPage・TypesPage・ItemsPage（項目の変更を `lib/items.ts` へ）・HomePage | — |
| 3 | C3 外枠と部品 | app/App（`AdminShell`）・components/ClientPicker・CommandPalette・MenuButton・Tour・placeLookup・scheduleParts（SelectionBar）・ui（SidePanel）・ClientFilter | — |

担当外のファイルは変えない。担当外の呼び出し側を変える必要が出たら、その片づけはやらずに PR の説明に書く。

## 3. 分け方の型（`.claude/skills/solo-architecture-design/references/code-principles.md` 5節）
1段ずつ、挙動を変えずに：
1. **計算を純粋関数へ。** `useMemo` の中身・イベントの中のデータの組み立てを `lib/`（または中核の層）の関数にし、テストを付ける
2. **状態と処理をカスタムフックへ。** 関係する `useState`・`useEffect`・ハンドラーの塊を `components/use*.ts`（画面専用なら同じディレクトリの `useXxx.ts`）にまとめる
3. **見た目を小さい部品へ。** 画面の区画（帯・欄・一覧）ごとに部品にし、props は表示に要るものと押したときだけ
4. **同じ形の処理が2画面にあれば共通の関数・部品へ**（上の表の「共通の関数」）

- フックは `lib/` に置かない（`lib` は React を import しない。層の決まりは `code-rules.json`）
- 1つの部品の props が15個を超えるなら、関連するものを1つのオブジェクトにまとめる
- 新しい関数を作る前に同じ働きのものを grep で探す（`lib/dateText`・`lib/ym`・`lib/spans` など）

## 4. 完了の条件（PR ごと）
- [ ] `npx tsc --noEmit`・`npm run lint`（エラー0）・`npm test`・`npm run build`
- [ ] 担当の画面に関係する e2e を手元で通す（`npm run build` のあと `npx vite preview --host 127.0.0.1 --port 4183 --strictPort &`、`BASE=http://127.0.0.1:4183/ npx playwright test --project=e2e --grep <スクリプト名>`。全部は CI が回す）
- [ ] 担当の `[func-lines]` が無くなった、または大きく減った。`npm run check:code -- --update-baseline --sync-biome` で基準を縮めてコミットする
- [ ] push の前に `git fetch origin main && git merge origin/main`。`code-rules.baseline.json`・`biome.json` がぶつかったら、手で直さず main 側を取ってから `npm run check:code -- --update-baseline --sync-biome` で作り直す
- [ ] PR の CI（速い検査・e2e 4つ・perf）が緑になったら main にマージする（merge commit）
- [ ] design/*.md にファイルの置き場所・部品の名前が書いてあれば合わせる

## 5. 終わったら
- 進み具合はこのファイルに書き足さない（ぶつかるので）。PR のタイトルに担当（例「A3 日の予定」）を書く
- 最後の波の最後にマージする PR でこのファイルを消す
