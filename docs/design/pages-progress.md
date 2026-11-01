# 予定に共通の進み具合の帯・日の状態の共通フック

> この画面のファイル：`src/components/progressBand.tsx`（`progressBand.css`）・`src/lib/progressBand.ts`・`src/lib/dayStatuses.ts`・`src/components/useDayStatuses.ts`。関連 ADR：0025・0038・0044・0062。関連 PRD：D151〜D155・D161・D393・D401・D404。

### ホームは置かない（PRD D401・D404）

`#/home`・起動（`#/`）・知らない URL は予定の画面（`lib/nav` の `homePath(features)`＝月か週）へ移す（`Navigate replace`。`App.tsx`）。今日やることは予定の上の要対応の帯（[pages-nav.md](pages-nav.md) の「要対応の帯」）と「その他 ▾」が受け持つ。月の後半の日 15 は `lib/scheduleMode` の `LATE_MONTH_FROM_DAY`。

### 日の状態の共通フック（`components/useDayStatuses.ts`。計算と日ごとの覚えは `lib/dayStatuses.ts` の `createDayStatusMemo`）

- 月の予定・進み具合の帯・週の準備・要対応・要対応の帯で共通（数え方が食い違わない）
- 点数の基準の条件で compile・採点し、訪問ごとの検査（`visitIssues`）・伝えた状態（`toldStateOf`）・拘束が上限を超える人を `dayStatus` に渡す
- 日ごとの覚えはモジュールの `MEMO`（日付ごとに最近3件・400日まで。点数の基準の条件は JSON で比べる）。画面を移っても使う

### 進み具合の帯（PRD D151〜D155）

月の予定の「詳しく ▾」（PRD D393）の中だけに置く（週・日には出さない。PRD D332）。数えるのは見ている月の今日以降の日。印刷では出さない。

#### `lib/progressBand.ts`（純粋関数。テストあり）

- `bandNext({ progress, emptyTargets, urgent, confirmStep? })`：次の一手 `BandNext`＝種類 `batch|attention|unconfirmed|done|empty`・文・短い文。順は
  1. 今日以降に訪問が無い → empty（「今日以降の訪問はありません」）
  2. 担当なしの訪問がある日が2日以上 → 担当を AI で組む
  3. 手当てが要る要対応（要対応の訪問） → 要対応を見る
  4. 確定していない日 → 確定していない日を見る（`confirmStep: false`＝expert 切は飛ばす）
  5. 見るだけの要対応（未連絡の変更・拘束超） → 要対応を見る
  6. 無ければ済み（「準備は済みました」）
- `urgentCount(attention)`：手当てが要る要対応（`care`）の件数
- `bandHref(ym, op)`：`batch` は担当を組むの画面 `/arrange?ym=…`、ほかは `/month?ym=…&do=…`
- `visitsText`：「N件」

#### `components/progressBand.tsx`（`progressBand.css`。`data-testid="progress-band"`）

- `ProgressBand({ ym, model, onOp? })`：見た目だけ（`pages/monthSections` が置く）
  - `model` は `BandModel`＝`monthProgress`・担当なしの訪問がある日の数・手当てが要る要対応の件数。null の間は同じ高さで「数えています…」（`aria-busy`）
  - 数字は `Link`：訪問（`band-visits`）・担当（`band-plans`）→ 担当を組むの画面、確定（`band-confirm`。expert 入だけ）→ `do=unconfirmed`、要対応（`band-attention`）→ `do=attention`。`onOp` があれば移らずにそれを呼ぶ（修飾キー（Ctrl・⌘・Shift・Alt）と左以外のボタンでは横取りしない）
  - 右に次の一手（`band-next`。`Link` の従のボタン。主ボタンは操作の行の1つ。済み・訪問なしは文だけ）
  - 下の縁に `lib/glance` の `prepParts` の細い積み上げ（`.prep-bar`・`.prep-part`）
  - 600px 以下は1行（「日」「件」を省き、ボタンは短い文）
  - 読み上げ：数字のリンクに aria-label（「担当が全部入った日 x/y日（済）。担当を組むの画面を開く」など）、✓ に sr-only の「済」、手当てが要る要対応に「要手当て」
- `BandLive`（`band-live`）：aria-live。最初は空で置き、数え直して文が変わったときだけ中身を入れる
- 速く出す（e2e の上限 `PERF_MS_PROGRESS` 既定 3000ms）

#### 置く所

| 画面 | 置き方 |
|---|---|
| 月（`pages/MonthPage`） | 「詳しく ▾」の中に `ProgressBand`。`onOp` で要対応・確定していない日は欄を画面の中で開く（URL は変えない）。「担当を AI で組む」は担当を組むの画面（その月）へ移る。詳しくは [pages-month.md](pages-month.md) |
| 週・日 | 出さない。週は1行の状態 `week-status`、日は見出しの状態の印。`?do=` のリンクは月の予定の欄を開き、`?do=` は月の予定が消す |

#### 確かめ

`scripts/e2e-progress.cjs`（項目は [../e2e.md](../e2e.md)）
